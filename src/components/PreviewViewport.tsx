import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClipboardPaste,
  LayoutTemplate,
  Maximize2,
  Move,
  Sparkles,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  LayoutMode,
  MergerImage,
  MergerSettings,
  OutputStats,
  PreviewBackdrop,
} from '../types/merger';
import {
  computeFitZoomScale,
  getEffectiveImageDimensions,
} from '../utils/canvasEngine';
import { SAMPLE_TEMPLATES, type SampleTemplateSpec } from '../utils/sampleGenerator';

interface PreviewViewportProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  images: MergerImage[];
  settings: MergerSettings;
  outputStats: OutputStats;
  selectedLayerId: string | null;
  backdrop: PreviewBackdrop;
  resetViewSignal: number;
  onChangeBackdrop: (b: PreviewBackdrop) => void;
  onBrowseFiles: () => void;
  onDropFiles: (files: FileList) => void;
  onPasteClipboard: () => void;
  onLoadTemplate: (spec: SampleTemplateSpec) => void;
  onSelectLayer: (id: string) => void;
  onStartOverlayDrag: () => void;
  onDragOverlayLayer: (id: string, x: number, y: number) => void;
  onNudgeOverlayLayer: (dx: number, dy: number) => void;
  onAutoArrange: () => void;
}

export const PreviewViewport: React.FC<PreviewViewportProps> = ({
  canvasRef,
  images,
  settings,
  outputStats,
  selectedLayerId,
  backdrop,
  resetViewSignal,
  onChangeBackdrop,
  onBrowseFiles,
  onDropFiles,
  onPasteClipboard,
  onLoadTemplate,
  onSelectLayer,
  onStartOverlayDrag,
  onDragOverlayLayer,
  onNudgeOverlayLayer,
  onAutoArrange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragMode, setDragMode] = useState<'pan' | 'layer' | null>(null);
  const [dragDropActive, setDragDropActive] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState({ x: false, y: false });
  const overlayDragCommittedRef = useRef(false);

  const pointerStartRef = useRef({
    clientX: 0,
    clientY: 0,
    panX: 0,
    panY: 0,
    layerX: 0,
    layerY: 0,
    layerId: '',
  });

  // Fit merged canvas cleanly within the current viewport bounds while preserving aspect ratio
  const fitToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container || outputStats.width <= 0 || outputStats.height <= 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const ratio = computeFitZoomScale(
      outputStats.width,
      outputStats.height,
      container.clientWidth,
      container.clientHeight,
      48,
    );
    setZoom(ratio);
    setPan({ x: 0, y: 0 });
    setAutoFit(true);
  }, [outputStats.width, outputStats.height]);

  // Keep canvas fitted when autoFit is enabled and dimensions change
  useEffect(() => {
    if (images.length === 0) return;
    if (!autoFit) return;
    const id = window.requestAnimationFrame(() => fitToViewport());
    return () => window.cancelAnimationFrame(id);
  }, [images.length, settings.layout, outputStats.width, outputStats.height, autoFit, fitToViewport]);

  // Re-fit on viewport container resize when autoFit is enabled
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (autoFit && images.length > 0) {
        fitToViewport();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoFit, images.length, fitToViewport]);

  useEffect(() => {
    if (resetViewSignal > 0) {
      fitToViewport();
    }
  }, [resetViewSignal, fitToViewport]);

  // Native non-passive wheel listener so canvas zoom never scrolls the outer page or triggers passive warnings
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (images.length === 0) return;
      e.preventDefault();
      setAutoFit(false);
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(4, Math.max(0.05, Number((z + delta).toFixed(2)))));
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [images.length]);

  const hitTestOverlayLayer = (clientX: number, clientY: number): MergerImage | null => {
    const canvas = canvasRef.current;
    if (!canvas || settings.layout !== 'overlay' || images.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const canvasX = ((clientX - rect.left) / rect.width) * outputStats.rawWidth;
    const canvasY = ((clientY - rect.top) / rect.height) * outputStats.rawHeight;
    const worldX = canvasX - outputStats.rawWidth / 2;
    const worldY = canvasY - outputStats.rawHeight / 2;

    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      const eff = getEffectiveImageDimensions(img);
      const w = (eff.width * img.scale) / 100;
      const h = (eff.height * img.scale) / 100;
      const dx = worldX - img.x;
      const dy = worldY - img.y;
      const rad = (-img.rotation * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2) {
        return img;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (images.length === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (settings.layout === 'overlay') {
      const hit = hitTestOverlayLayer(e.clientX, e.clientY);
      if (hit) {
        onSelectLayer(hit.id);
        overlayDragCommittedRef.current = false;
        setIsDraggingCanvas(true);
        setDragMode('layer');
        pointerStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          panX: pan.x,
          panY: pan.y,
          layerX: hit.x,
          layerY: hit.y,
          layerId: hit.id,
        };
        return;
      }
    }

    setAutoFit(false);
    setIsDraggingCanvas(true);
    setDragMode('pan');
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      layerX: 0,
      layerY: 0,
      layerId: '',
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCanvas || !dragMode) return;
    const dx = e.clientX - pointerStartRef.current.clientX;
    const dy = e.clientY - pointerStartRef.current.clientY;

    if (dragMode === 'pan') {
      setPan({
        x: pointerStartRef.current.panX + dx,
        y: pointerStartRef.current.panY + dy,
      });
    } else if (dragMode === 'layer') {
      if (!overlayDragCommittedRef.current && Math.hypot(dx, dy) > 2) {
        overlayDragCommittedRef.current = true;
        onStartOverlayDrag();
      }
      if (!overlayDragCommittedRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ratioX = rect.width > 0 ? outputStats.rawWidth / rect.width : 1 / zoom;
      const ratioY = rect.height > 0 ? outputStats.rawHeight / rect.height : 1 / zoom;

      let nextX = Math.round(pointerStartRef.current.layerX + dx * ratioX);
      let nextY = Math.round(pointerStartRef.current.layerY + dy * ratioY);

      const snapX = Math.abs(nextX) <= 8;
      const snapY = Math.abs(nextY) <= 8;
      if (snapX) nextX = 0;
      if (snapY) nextY = 0;
      setSnapGuides({ x: snapX, y: snapY });

      onDragOverlayLayer(pointerStartRef.current.layerId, nextX, nextY);
    }
  };

  const handlePointerUp = () => {
    setIsDraggingCanvas(false);
    setDragMode(null);
    overlayDragCommittedRef.current = false;
    setSnapGuides({ x: false, y: false });
  };

  const handleStageKeyDown = (e: React.KeyboardEvent) => {
    if (settings.layout !== 'overlay' || images.length === 0) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onNudgeOverlayLayer(-step, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNudgeOverlayLayer(step, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNudgeOverlayLayer(0, -step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNudgeOverlayLayer(0, step);
    }
  };

  const backdropClass =
    backdrop === 'checker'
      ? 'drafting-grid'
      : backdrop === 'light'
        ? 'bg-white'
        : 'bg-well';

  const triggerTemplate = async (spec: SampleTemplateSpec) => {
    setLoadingTemplateId(spec.id);
    try {
      await onLoadTemplate(spec);
    } finally {
      setLoadingTemplateId(null);
    }
  };

  return (
    <section
      aria-label="Live canvas preview"
      className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-surface"
    >
      {/* Preview Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm font-semibold text-foreground">
            Live Canvas Preview
          </h2>
          {settings.layout === 'overlay' && images.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Move className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Drag layers directly on canvas</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Backdrop Switcher */}
          <div
            role="group"
            aria-label="Preview backdrop surface"
            className="flex items-center rounded-control bg-well p-0.5"
          >
            {(['checker', 'light', 'dark'] as PreviewBackdrop[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeBackdrop(mode)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  backdrop === mode
                    ? 'bg-surface text-foreground shadow-surface'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Zoom & Auto-Fit Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAutoFit(false);
                setZoom((z) => Math.max(0.05, Number((z - 0.15).toFixed(2))));
              }}
              aria-label="Zoom out"
              disabled={images.length === 0}
              className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-foreground hover:bg-well disabled:opacity-45"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <span
              data-testid="preview-zoom-readout"
              className="min-w-[44px] text-center font-mono text-xs font-semibold text-foreground tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() => {
                setAutoFit(false);
                setZoom((z) => Math.min(4, Number((z + 0.15).toFixed(2))));
              }}
              aria-label="Zoom in"
              disabled={images.length === 0}
              className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-foreground hover:bg-well disabled:opacity-45"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid="viewport-auto-arrange-btn"
              onClick={onAutoArrange}
              disabled={images.length === 0}
              title="Auto-arrange spacing and scaling for current layout (A)"
              aria-label="Auto-arrange layout"
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-primary/40 bg-accent-soft px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>Auto-Arrange</span>
            </button>

            <button
              type="button"
              data-testid="fit-to-viewport-btn"
              onClick={fitToViewport}
              disabled={images.length === 0}
              aria-pressed={autoFit}
              title="Automatically scale canvas to fit viewport (R)"
              aria-label="Fit preview to viewport"
              className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 ${
                autoFit && images.length > 0
                  ? 'border-primary bg-accent-soft text-primary'
                  : 'border-border bg-surface text-foreground hover:bg-well'
              }`}
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
              <span>Fit to View</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAutoFit(false);
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              disabled={images.length === 0}
              aria-label="Reset zoom to 100%"
              className="inline-flex min-h-8 cursor-pointer items-center rounded-control border border-border bg-surface px-2.5 font-mono text-xs font-medium text-foreground hover:bg-well disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              1:1
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Stage or Rich Empty State */}
      <div
        ref={containerRef}
        tabIndex={images.length > 0 && settings.layout === 'overlay' ? 0 : -1}
        aria-label={
          settings.layout === 'overlay' && images.length > 0
            ? 'Interactive canvas stage. Use arrow keys to nudge selected overlay layer.'
            : undefined
        }
        onKeyDown={handleStageKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          setDragDropActive(true);
        }}
        onDragLeave={() => setDragDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragDropActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDropFiles(e.dataTransfer.files);
          }
        }}
        className={`relative flex h-[460px] sm:h-[520px] items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${backdropClass} ${
          images.length > 0
            ? dragMode === 'pan'
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : ''
        } ${dragDropActive ? 'ring-2 ring-inset ring-primary' : ''}`}
      >
        {/* Center Snap Guides in Overlay Drag */}
        {snapGuides.x && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary"
          />
        )}
        {snapGuides.y && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary"
          />
        )}

        {/* Merged Canvas */}
        <canvas
          ref={canvasRef}
          data-testid="merged-preview-canvas"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            display: images.length > 0 ? 'block' : 'none',
          }}
          className="max-w-none shadow-lg"
        />

        {/* Quick Fit Overlay Button when user zoomed/panned manually */}
        {images.length > 0 && !autoFit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fitToViewport();
            }}
            className="absolute bottom-3 right-3 z-10 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-xs transition-colors hover:border-primary hover:text-primary"
          >
            <Maximize2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Re-fit Canvas</span>
          </button>
        )}

        {/* Empty State Upload & Quick-Start Samples */}
        {images.length === 0 && (
          <div className="z-10 mx-auto flex max-w-2xl flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface text-primary shadow-surface">
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            </div>

            <h3 className="font-display text-xl font-bold text-foreground text-balance">
              Drop images to stitch, collage, or layer locally
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              100% private in-browser Canvas engine. Supports PNG, JPEG, WebP, GIF, and SVG up to 50 images.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBrowseFiles}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                <span>Select Images</span>
              </button>

              <button
                type="button"
                onClick={onPasteClipboard}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-well"
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                <span>Paste (Ctrl+V)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick-Start Templates Section */}
      <div
        id="templates-section"
        className="border-t border-border bg-well/40 px-4 py-3"
      >
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <LayoutTemplate className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Sample Workflows</span>
          </div>
          <span className="text-[11px] text-muted">
            Generated locally — zero network uploads
          </span>
        </div>

        {images.length === 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SAMPLE_TEMPLATES.map((spec) => (
              <button
                key={spec.id}
                type="button"
                disabled={loadingTemplateId === spec.id}
                onClick={() => triggerTemplate(spec)}
                className="flex cursor-pointer flex-col rounded-control border border-border bg-surface p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent-soft/40 disabled:opacity-50"
              >
                <span className="text-xs font-semibold text-foreground">
                  {loadingTemplateId === spec.id ? 'Generating...' : spec.title}
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">
                  {spec.subtitle}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_TEMPLATES.map((spec) => (
              <button
                key={spec.id}
                type="button"
                disabled={loadingTemplateId === spec.id}
                onClick={() => triggerTemplate(spec)}
                className="min-h-8 cursor-pointer rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {loadingTemplateId === spec.id ? 'Generating...' : spec.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
