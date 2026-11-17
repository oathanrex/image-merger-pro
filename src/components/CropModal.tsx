import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Focus, RotateCcw, Scissors, X } from 'lucide-react';
import type { CropAspectPreset, CropRect, MergerImage } from '../types/merger';
import {
  CROP_ASPECT_RATIOS,
  clamp,
  computeAspectCropRect,
  detectSmartFocalPoint,
} from '../utils/canvasEngine';

interface CropModalProps {
  image: MergerImage | null;
  onClose: () => void;
  onApplyCrop: (id: string, crop: CropRect | undefined) => void;
}

type DragHandle =
  | 'move'
  | 'focal'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'n'
  | 's'
  | 'w'
  | 'e'
  | null;

const ASPECT_OPTIONS: Array<{ value: CropAspectPreset; label: string }> = [
  { value: 'free', label: 'Free' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: 'id-card', label: 'ID Card' },
];

export const CropModal: React.FC<CropModalProps> = ({ image, onClose, onApplyCrop }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rect, setRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    aspectPreset: 'free',
    focalX: 0.5,
    focalY: 0.5,
  });
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>('free');
  const [customRatioEnabled, setCustomRatioEnabled] = useState(false);
  const [customRatioW, setCustomRatioW] = useState(16);
  const [customRatioH, setCustomRatioH] = useState(10);
  const [focalPickMode, setFocalPickMode] = useState(false);

  const dragRef = useRef<{
    handle: DragHandle;
    startClientX: number;
    startClientY: number;
    startRect: CropRect;
  }>({
    handle: null,
    startClientX: 0,
    startClientY: 0,
    startRect: { x: 0, y: 0, width: 100, height: 100 },
  });

  useEffect(() => {
    if (!image) return;
    const initial: CropRect = image.crop
      ? {
          ...image.crop,
          focalX: image.crop.focalX ?? (image.crop.x + image.crop.width / 2) / image.width,
          focalY: image.crop.focalY ?? (image.crop.y + image.crop.height / 2) / image.height,
        }
      : {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
          aspectPreset: 'free',
          focalX: 0.5,
          focalY: 0.5,
        };
    setRect(initial);
    setAspectPreset(initial.aspectPreset ?? 'free');
    setCustomRatioEnabled(false);
    setFocalPickMode(false);
  }, [image]);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, onClose]);

  const activeRatio: number | null = customRatioEnabled
    ? Math.max(0.1, customRatioW) / Math.max(0.1, customRatioH)
    : CROP_ASPECT_RATIOS[aspectPreset];

  // Draw interactive canvas stage
  useEffect(() => {
    if (!image?.img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const maxStageW = 620;
    const maxStageH = 380;
    const scale = Math.min(maxStageW / image.width, maxStageH / image.height, 1);
    const stageW = Math.max(120, Math.round(image.width * scale));
    const stageH = Math.max(90, Math.round(image.height * scale));

    canvas.width = stageW;
    canvas.height = stageH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, stageW, stageH);
    ctx.drawImage(image.img, 0, 0, stageW, stageH);

    const rx = (rect.x / image.width) * stageW;
    const ry = (rect.y / image.height) * stageH;
    const rw = (rect.width / image.width) * stageW;
    const rh = (rect.height / image.height) * stageH;

    ctx.fillStyle = 'rgba(15, 23, 28, 0.60)';
    ctx.beginPath();
    ctx.rect(0, 0, stageW, stageH);
    ctx.rect(rx, ry, rw, rh);
    ctx.fill('evenodd');

    // Crop outline (emerald theme primary)
    ctx.strokeStyle = '#16a374';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    // Rule-of-thirds guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + rw / 3, ry);
    ctx.lineTo(rx + rw / 3, ry + rh);
    ctx.moveTo(rx + (2 * rw) / 3, ry);
    ctx.lineTo(rx + (2 * rw) / 3, ry + rh);
    ctx.moveTo(rx, ry + rh / 3);
    ctx.lineTo(rx + rw, ry + rh / 3);
    ctx.moveTo(rx, ry + (2 * rh) / 3);
    ctx.lineTo(rx + rw, ry + (2 * rh) / 3);
    ctx.stroke();

    // 8 Resize Handles
    const handlePoints = [
      [rx, ry],
      [rx + rw / 2, ry],
      [rx + rw, ry],
      [rx + rw, ry + rh / 2],
      [rx + rw, ry + rh],
      [rx + rw / 2, ry + rh],
      [rx, ry + rh],
      [rx, ry + rh / 2],
    ];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#12875f';
    ctx.lineWidth = 2;
    for (const [hx, hy] of handlePoints) {
      ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.strokeRect(hx - 5, hy - 5, 10, 10);
    }

    // Focal point crosshair marker
    const fx = (rect.focalX ?? (rect.x + rect.width / 2) / image.width) * stageW;
    const fy = (rect.focalY ?? (rect.y + rect.height / 2) / image.height) * stageH;
    ctx.strokeStyle = '#6ee7b7';
    ctx.fillStyle = '#12875f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(fx - 4, fy);
    ctx.lineTo(fx + 4, fy);
    ctx.moveTo(fx, fy - 4);
    ctx.lineTo(fx, fy + 4);
    ctx.stroke();
  }, [image, rect]);

  if (!image) return null;

  const clientToImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { ix: 0, iy: 0 };
    const bounds = canvas.getBoundingClientRect();
    const nx = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const ny = clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
    return {
      ix: nx * image.width,
      iy: ny * image.height,
    };
  };

  const detectHandle = (ix: number, iy: number): DragHandle => {
    if (focalPickMode) return 'focal';
    const canvas = canvasRef.current;
    const tol = canvas
      ? Math.max(12, (16 * image.width) / Math.max(1, canvas.getBoundingClientRect().width))
      : 18;

    const nearLeft = Math.abs(ix - rect.x) <= tol;
    const nearRight = Math.abs(ix - (rect.x + rect.width)) <= tol;
    const nearTop = Math.abs(iy - rect.y) <= tol;
    const nearBottom = Math.abs(iy - (rect.y + rect.height)) <= tol;
    const withinX = ix >= rect.x - tol && ix <= rect.x + rect.width + tol;
    const withinY = iy >= rect.y - tol && iy <= rect.y + rect.height + tol;

    if (nearLeft && nearTop) return 'nw';
    if (nearRight && nearTop) return 'ne';
    if (nearLeft && nearBottom) return 'sw';
    if (nearRight && nearBottom) return 'se';
    if (nearTop && withinX) return 'n';
    if (nearBottom && withinX) return 's';
    if (nearLeft && withinY) return 'w';
    if (nearRight && withinY) return 'e';
    if (ix >= rect.x && ix <= rect.x + rect.width && iy >= rect.y && iy <= rect.y + rect.height) {
      return 'move';
    }
    return 'focal';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { ix, iy } = clientToImageCoords(e.clientX, e.clientY);
    const handle = detectHandle(ix, iy);

    if (handle === 'focal') {
      const fx = clamp(ix / image.width, 0, 1);
      const fy = clamp(iy / image.height, 0, 1);
      if (activeRatio) {
        setRect(
          computeAspectCropRect(
            image.width,
            image.height,
            activeRatio,
            fx,
            fy,
            aspectPreset,
          ),
        );
      } else {
        const nextX = Math.round(clamp(ix - rect.width / 2, 0, image.width - rect.width));
        const nextY = Math.round(clamp(iy - rect.height / 2, 0, image.height - rect.height));
        setRect((prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
          focalX: fx,
          focalY: fy,
        }));
      }
      setFocalPickMode(false);
      return;
    }

    dragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: { ...rect },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { handle, startClientX, startClientY, startRect } = dragRef.current;
    if (!handle || !canvasRef.current) return;

    const bounds = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - startClientX) / Math.max(1, bounds.width)) * image.width;
    const dy = ((e.clientY - startClientY) / Math.max(1, bounds.height)) * image.height;

    const minSize = Math.min(32, image.width, image.height);

    if (handle === 'move') {
      const nextX = Math.round(clamp(startRect.x + dx, 0, image.width - startRect.width));
      const nextY = Math.round(clamp(startRect.y + dy, 0, image.height - startRect.height));
      setRect({
        ...startRect,
        x: nextX,
        y: nextY,
        focalX: Number(((nextX + startRect.width / 2) / image.width).toFixed(3)),
        focalY: Number(((nextY + startRect.height / 2) / image.height).toFixed(3)),
      });
      return;
    }

    let left = startRect.x;
    let top = startRect.y;
    let right = startRect.x + startRect.width;
    let bottom = startRect.y + startRect.height;

    if (handle.includes('w')) left = clamp(startRect.x + dx, 0, right - minSize);
    if (handle.includes('e')) right = clamp(startRect.x + startRect.width + dx, left + minSize, image.width);
    if (handle.includes('n')) top = clamp(startRect.y + dy, 0, bottom - minSize);
    if (handle.includes('s')) bottom = clamp(startRect.y + startRect.height + dy, top + minSize, image.height);

    let nextW = Math.round(right - left);
    let nextH = Math.round(bottom - top);

    if (activeRatio && activeRatio > 0) {
      if (handle === 'n' || handle === 's') {
        nextW = Math.round(nextH * activeRatio);
      } else {
        nextH = Math.round(nextW / activeRatio);
      }
      if (left + nextW > image.width) {
        nextW = image.width - left;
        nextH = Math.round(nextW / activeRatio);
      }
      if (top + nextH > image.height) {
        nextH = image.height - top;
        nextW = Math.round(nextH * activeRatio);
      }
      nextW = Math.max(minSize, nextW);
      nextH = Math.max(minSize, nextH);
    }

    const finalX = Math.round(clamp(left, 0, image.width - nextW));
    const finalY = Math.round(clamp(top, 0, image.height - nextH));

    setRect({
      x: finalX,
      y: finalY,
      width: nextW,
      height: nextH,
      aspectPreset,
      focalX: Number(((finalX + nextW / 2) / image.width).toFixed(3)),
      focalY: Number(((finalY + nextH / 2) / image.height).toFixed(3)),
    });
  };

  const handlePointerUp = () => {
    dragRef.current.handle = null;
  };

  const handleSelectAspect = (preset: CropAspectPreset) => {
    setCustomRatioEnabled(false);
    setAspectPreset(preset);
    const ratio = CROP_ASPECT_RATIOS[preset];
    const fx = rect.focalX ?? (rect.x + rect.width / 2) / image.width;
    const fy = rect.focalY ?? (rect.y + rect.height / 2) / image.height;
    setRect(computeAspectCropRect(image.width, image.height, ratio, fx, fy, preset));
  };

  const handleApplyCustomRatio = (wVal: number, hVal: number) => {
    const safeW = Math.max(1, wVal);
    const safeH = Math.max(1, hVal);
    setCustomRatioW(safeW);
    setCustomRatioH(safeH);
    setCustomRatioEnabled(true);
    const fx = rect.focalX ?? 0.5;
    const fy = rect.focalY ?? 0.5;
    setRect(computeAspectCropRect(image.width, image.height, safeW / safeH, fx, fy, 'free'));
  };

  const handleSmartFocalDetect = () => {
    if (!image.img) return;
    const { focalX, focalY } = detectSmartFocalPoint(image.img);
    const ratio = activeRatio ?? (rect.width < image.width || rect.height < image.height ? rect.width / rect.height : 4 / 3);
    const nextPreset: CropAspectPreset = activeRatio ? aspectPreset : '4:3';
    if (!activeRatio) {
      setAspectPreset('4:3');
      setCustomRatioEnabled(false);
    }
    setRect(computeAspectCropRect(image.width, image.height, ratio, focalX, focalY, nextPreset));
  };

  const handleNumericField = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    const v = Math.max(0, Math.round(value || 0));
    setRect((prev) => {
      const next = { ...prev };
      if (field === 'x') next.x = clamp(v, 0, Math.max(0, image.width - next.width));
      if (field === 'y') next.y = clamp(v, 0, Math.max(0, image.height - next.height));
      if (field === 'width') {
        next.width = clamp(v, 16, image.width - next.x);
        if (activeRatio) {
          next.height = clamp(Math.round(next.width / activeRatio), 16, image.height - next.y);
        }
      }
      if (field === 'height') {
        next.height = clamp(v, 16, image.height - next.y);
        if (activeRatio) {
          next.width = clamp(Math.round(next.height * activeRatio), 16, image.width - next.x);
        }
      }
      next.focalX = Number(((next.x + next.width / 2) / image.width).toFixed(3));
      next.focalY = Number(((next.y + next.height / 2) / image.height).toFixed(3));
      return next;
    });
  };

  const isFullFrame =
    rect.x === 0 && rect.y === 0 && rect.width === image.width && rect.height === image.height;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2
                id="crop-modal-title"
                className="font-display text-base font-bold text-foreground"
              >
                Intelligent Focal & Aspect Crop
              </h2>
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted tabular-nums">
              {image.name} · Source {image.width} × {image.height} px · Selection {rect.width} ×{' '}
              {rect.height} px
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crop dialog"
            className="cursor-pointer rounded-control p-1.5 text-muted hover:bg-well hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Aspect Ratio & Smart Focal Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Aspect ratio presets">
            {ASPECT_OPTIONS.map((opt) => {
              const active = !customRatioEnabled && aspectPreset === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectAspect(opt.value)}
                  className={`min-h-8 cursor-pointer rounded-control border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-well text-foreground hover:bg-accent-soft/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSmartFocalDetect}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-control border border-primary/40 bg-accent-soft px-3 text-xs font-semibold text-primary hover:opacity-90 whitespace-nowrap shrink-0"
            >
              <Focus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Smart Focal Crop</span>
            </button>

            <button
              type="button"
              onClick={() => setFocalPickMode((v) => !v)}
              aria-pressed={focalPickMode}
              className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                focalPickMode
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-well text-foreground hover:bg-accent-soft/60'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{focalPickMode ? 'Click Image...' : 'Set Focal Point'}</span>
            </button>
          </div>
        </div>

        {/* Custom Aspect Ratio Inputs */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-medium text-foreground">Custom Ratio:</span>
          <input
            type="number"
            aria-label="Custom ratio width"
            min={1}
            max={100}
            value={customRatioW}
            onChange={(e) => handleApplyCustomRatio(Number(e.target.value), customRatioH)}
            className="w-16 rounded-control border border-border bg-well px-2 py-1 font-mono text-xs text-foreground"
          />
          <span aria-hidden="true">:</span>
          <input
            type="number"
            aria-label="Custom ratio height"
            min={1}
            max={100}
            value={customRatioH}
            onChange={(e) => handleApplyCustomRatio(customRatioW, Number(e.target.value))}
            className="w-16 rounded-control border border-border bg-well px-2 py-1 font-mono text-xs text-foreground"
          />
          <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
            Focal ({Math.round((rect.focalX ?? 0.5) * 100)}%,{' '}
            {Math.round((rect.focalY ?? 0.5) * 100)}%)
          </span>
        </div>

        {/* Interactive Crop Canvas Stage */}
        <div className="mt-3 flex items-center justify-center rounded-control border border-border bg-well p-3">
          <canvas
            ref={canvasRef}
            data-testid="crop-editor-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`max-w-full select-none touch-none ${
              focalPickMode ? 'cursor-crosshair' : 'cursor-move'
            }`}
          />
        </div>

        {/* Exact Pixel Coordinates */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(
            [
              { key: 'x', label: 'Offset X (px)', max: image.width - 16 },
              { key: 'y', label: 'Offset Y (px)', max: image.height - 16 },
              { key: 'width', label: 'Width (px)', max: image.width },
              { key: 'height', label: 'Height (px)', max: image.height },
            ] as const
          ).map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`crop-${field.key}`}
                className="mb-1 block text-[11px] font-medium text-muted"
              >
                {field.label}
              </label>
              <input
                id={`crop-${field.key}`}
                type="number"
                min={field.key === 'width' || field.key === 'height' ? 16 : 0}
                max={field.max}
                value={rect[field.key]}
                onChange={(e) => handleNumericField(field.key, Number(e.target.value))}
                className="w-full rounded-control border border-border bg-well px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              onApplyCrop(image.id, undefined);
              onClose();
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-well px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent-soft/60"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset to Full Image</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 cursor-pointer rounded-control border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:bg-well"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyCrop(image.id, isFullFrame ? undefined : rect);
                onClose();
              }}
              className="min-h-9 cursor-pointer rounded-control bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
