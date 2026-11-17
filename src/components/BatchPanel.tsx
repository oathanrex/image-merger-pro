import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Scaling,
  Scissors,
  Sliders,
  Stamp,
} from 'lucide-react';
import type {
  BatchRenameCase,
  BatchRenameOptions,
  BatchResizeMode,
  BatchWatermarkOptions,
  CropAspectPreset,
  ImageFilters,
  MergerImage,
} from '../types/merger';
import { DEFAULT_FILTERS, generateBatchRenamedNames } from '../utils/canvasEngine';

interface BatchPanelProps {
  images: MergerImage[];
  selectedImageIds: string[];
  imageCount: number;
  busy: boolean;
  onSelectAllImages: () => void;
  onClearSelection: () => void;
  onBatchRename: (options: BatchRenameOptions) => void;
  onBatchApplyFilters: (filters: ImageFilters) => void;
  onBatchColorAdjust: (patch: Partial<ImageFilters>) => void;
  onBatchSharpen: (strength: number) => void;
  onBatchResize: (mode: BatchResizeMode, value: number) => Promise<void>;
  onBatchWatermark: (options: BatchWatermarkOptions) => Promise<void>;
  onBatchCropAspect: (preset: CropAspectPreset | 'reset') => void;
  onBatchTransform: (action: 'rotate90' | 'flipH' | 'flipV') => Promise<void>;
}

const BATCH_FILTER_RECIPES: Array<{ label: string; filters: ImageFilters }> = [
  {
    label: 'Document Scan',
    filters: { brightness: 108, contrast: 128, saturation: 15, hue: 0, grayscale: true, sharpen: 25 },
  },
  {
    label: 'Vivid Boost',
    filters: { brightness: 104, contrast: 112, saturation: 135, hue: 0, grayscale: false, sharpen: 10 },
  },
  {
    label: 'Monochrome',
    filters: { brightness: 100, contrast: 110, saturation: 100, hue: 0, grayscale: true, sharpen: 0 },
  },
  {
    label: 'Reset Colors',
    filters: { ...DEFAULT_FILTERS },
  },
];

const RENAME_PATTERNS = [
  { label: '{name}-{nn}', pattern: '{name}-{nn}' },
  { label: 'asset-{nnn}', pattern: 'asset-{nnn}' },
  { label: 'page-{nn}', pattern: 'page-{nn}' },
  { label: '{w}x{h}-{n}', pattern: '{w}x{h}-{n}' },
];

export const BatchPanel: React.FC<BatchPanelProps> = ({
  images,
  selectedImageIds,
  imageCount,
  busy,
  onSelectAllImages,
  onClearSelection,
  onBatchRename,
  onBatchApplyFilters,
  onBatchColorAdjust,
  onBatchSharpen,
  onBatchResize,
  onBatchWatermark,
  onBatchCropAspect,
  onBatchTransform,
}) => {
  const [renameOptions, setRenameOptions] = useState<BatchRenameOptions>({
    pattern: '{name}-{nn}',
    startNumber: 1,
    step: 1,
    zeroPad: 2,
    caseMode: 'preserve',
    preserveExtension: true,
  });
  const [filters, setFilters] = useState<ImageFilters>({ ...DEFAULT_FILTERS });
  const [resizeMode, setResizeMode] = useState<BatchResizeMode>('max-edge');
  const [resizeValue, setResizeValue] = useState<number>(1000);
  const [cropPreset, setCropPreset] = useState<CropAspectPreset>('1:1');
  const [watermark, setWatermark] = useState<BatchWatermarkOptions>({
    text: 'CONFIDENTIAL',
    position: 'bottom-right',
    fontSize: 24,
    color: '#1b8a64',
    opacity: 75,
  });

  const selectedSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const targetImages = useMemo(
    () => (selectedSet.size > 0 ? images.filter((im) => selectedSet.has(im.id)) : images),
    [images, selectedSet],
  );
  const hasExplicitSelection = selectedSet.size > 0 && targetImages.length > 0;

  useEffect(() => {
    if (targetImages.length === 0) return;
    const first = targetImages[0].filters;
    setFilters((prev) => {
      const next: ImageFilters = { ...prev };
      let changed = false;
      const syncField = <K extends keyof ImageFilters>(key: K, fallback: ImageFilters[K]) => {
        const val = first[key] ?? fallback;
        if (targetImages.every((im) => (im.filters?.[key] ?? fallback) === val) && next[key] !== val) {
          next[key] = val;
          changed = true;
        }
      };
      syncField('brightness', 100);
      syncField('contrast', 100);
      syncField('saturation', 100);
      syncField('hue', 0);
      syncField('sharpen', 0);
      syncField('grayscale', false);
      return changed ? next : prev;
    });
  }, [targetImages]);

  const disabled = imageCount === 0 || busy;

  const renamePreview = useMemo(
    () => generateBatchRenamedNames(images, renameOptions),
    [images, renameOptions],
  );

  return (
    <div className="space-y-4 divide-y divide-border/60">
      {imageCount === 0 && (
        <p className="rounded-control border border-border bg-well px-3 py-2.5 text-xs text-muted">
          Load 1 or more images to batch rename, filter, resize, focal-crop, or watermark your entire set before export.
        </p>
      )}

      {/* 1. Batch Color Adjustments (Shared Live Sliders for Selected Tray Images) */}
      <div className="space-y-2.5 pb-4" data-testid="batch-color-section">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sliders className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Batch Color Adjustments</span>
          </div>
          {imageCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters({ ...DEFAULT_FILTERS });
                onBatchApplyFilters({ ...DEFAULT_FILTERS });
              }}
              data-testid="batch-color-reset-btn"
              disabled={disabled}
              className="cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline disabled:opacity-45"
            >
              Reset
            </button>
          )}
        </div>

        {imageCount > 0 && (
          <div
            data-testid="batch-color-scope"
            className="flex items-center justify-between gap-2 rounded-control border border-border bg-well/70 px-2.5 py-1.5 text-[11px]"
          >
            <span className="text-foreground">
              {hasExplicitSelection
                ? `Applying to ${targetImages.length} of ${imageCount} selected`
                : `All ${imageCount} images (select cards in tray to scope)`}
            </span>
            {hasExplicitSelection ? (
              <button
                type="button"
                onClick={onClearSelection}
                className="shrink-0 cursor-pointer font-medium text-primary hover:underline"
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={onSelectAllImages}
                className="shrink-0 cursor-pointer font-medium text-primary hover:underline"
              >
                Select All
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {BATCH_FILTER_RECIPES.map((recipe) => (
            <button
              key={recipe.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                setFilters({ ...recipe.filters });
                onBatchApplyFilters({ ...recipe.filters });
              }}
              className="min-h-8 cursor-pointer rounded-control border border-border bg-well px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {recipe.label}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <label htmlFor="batch-brightness-slider" className="text-muted">
              Brightness
            </label>
            <span className="font-mono text-foreground tabular-nums">{filters.brightness}%</span>
          </div>
          <input
            id="batch-brightness-slider"
            data-testid="batch-brightness-slider"
            type="range"
            aria-label="Batch brightness"
            min={50}
            max={150}
            disabled={disabled}
            value={filters.brightness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFilters((prev) => ({ ...prev, brightness: val }));
              onBatchColorAdjust({ brightness: val });
            }}
            className="studio-range w-full disabled:opacity-45"
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <label htmlFor="batch-contrast-slider" className="text-muted">
              Contrast
            </label>
            <span className="font-mono text-foreground tabular-nums">{filters.contrast}%</span>
          </div>
          <input
            id="batch-contrast-slider"
            data-testid="batch-contrast-slider"
            type="range"
            aria-label="Batch contrast"
            min={50}
            max={150}
            disabled={disabled}
            value={filters.contrast}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFilters((prev) => ({ ...prev, contrast: val }));
              onBatchColorAdjust({ contrast: val });
            }}
            className="studio-range w-full disabled:opacity-45"
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <label htmlFor="batch-saturation-slider" className="text-muted">
              Saturation
            </label>
            <span className="font-mono text-foreground tabular-nums">{filters.saturation}%</span>
          </div>
          <input
            id="batch-saturation-slider"
            data-testid="batch-saturation-slider"
            type="range"
            aria-label="Batch saturation"
            min={0}
            max={200}
            disabled={disabled}
            value={filters.saturation}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFilters((prev) => ({ ...prev, saturation: val }));
              onBatchColorAdjust({ saturation: val });
            }}
            className="studio-range w-full disabled:opacity-45"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <label htmlFor="batch-hue-slider" className="text-muted">
              Hue Shift
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground tabular-nums">
                {(filters.hue ?? 0) > 0 ? `+${filters.hue}` : filters.hue ?? 0}°
              </span>
              {(filters.hue ?? 0) !== 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, hue: 0 }));
                    onBatchColorAdjust({ hue: 0 });
                  }}
                  className="cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline disabled:opacity-45"
                >
                  0°
                </button>
              )}
            </div>
          </div>
          <input
            id="batch-hue-slider"
            data-testid="batch-hue-slider"
            type="range"
            aria-label="Batch hue shift"
            min={-180}
            max={180}
            step={1}
            disabled={disabled}
            value={filters.hue ?? 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFilters((prev) => ({ ...prev, hue: val }));
              onBatchColorAdjust({ hue: val });
            }}
            className="studio-range w-full disabled:opacity-45"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <label htmlFor="batch-sharpen-slider" className="font-medium text-foreground">
              Detail Sharpen (3×3 Kernel)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {filters.sharpen ?? 0}%
              </span>
              {(filters.sharpen ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, sharpen: 0 }));
                    onBatchSharpen(0);
                  }}
                  className="cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline disabled:opacity-45"
                >
                  0%
                </button>
              )}
            </div>
          </div>
          <input
            id="batch-sharpen-slider"
            data-testid="batch-sharpen-slider"
            type="range"
            aria-label="Batch sharpen intensity"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={filters.sharpen ?? 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFilters((prev) => ({ ...prev, sharpen: val }));
              onBatchSharpen(val);
            }}
            className="studio-range w-full disabled:opacity-45"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
          <span>Grayscale</span>
          <input
            type="checkbox"
            disabled={disabled}
            checked={filters.grayscale}
            onChange={(e) => {
              const checked = e.target.checked;
              setFilters((prev) => ({ ...prev, grayscale: checked }));
              onBatchColorAdjust({ grayscale: checked });
            }}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
        </label>
      </div>

      {/* 2. Batch Rename Before Export */}
      <div className="space-y-2.5 py-4" data-testid="batch-rename-section">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Batch Rename Files</span>
          </div>
          <span className="font-mono text-[11px] text-muted">
            {'{name}'} {'{nn}'} {'{w}'} {'{h}'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {RENAME_PATTERNS.map((preset) => (
            <button
              key={preset.pattern}
              type="button"
              onClick={() =>
                setRenameOptions((prev) => ({ ...prev, pattern: preset.pattern }))
              }
              className={`min-h-7 cursor-pointer rounded-control border px-2 py-1 font-mono text-[11px] transition-colors ${
                renameOptions.pattern === preset.pattern
                  ? 'border-primary bg-accent-soft text-primary font-semibold'
                  : 'border-border bg-well text-foreground hover:border-primary/60'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div>
          <label
            htmlFor="batch-rename-pattern"
            className="mb-1 block text-[11px] text-muted"
          >
            Naming Pattern
          </label>
          <input
            id="batch-rename-pattern"
            data-testid="batch-rename-pattern-input"
            type="text"
            value={renameOptions.pattern}
            onChange={(e) =>
              setRenameOptions((prev) => ({ ...prev, pattern: e.target.value }))
            }
            placeholder="e.g. scan-{nn} or {name}-{nnn}"
            className="w-full rounded-control border border-border bg-well px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label htmlFor="rename-start" className="mb-1 block text-[11px] text-muted">
              Start #
            </label>
            <input
              id="rename-start"
              data-testid="batch-rename-start-input"
              type="number"
              min={0}
              max={9999}
              value={renameOptions.startNumber}
              onChange={(e) =>
                setRenameOptions((prev) => ({
                  ...prev,
                  startNumber: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="w-full rounded-control border border-border bg-well px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rename-step" className="mb-1 block text-[11px] text-muted">
              Step
            </label>
            <input
              id="rename-step"
              type="number"
              min={1}
              max={100}
              value={renameOptions.step}
              onChange={(e) =>
                setRenameOptions((prev) => ({
                  ...prev,
                  step: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="w-full rounded-control border border-border bg-well px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rename-pad" className="mb-1 block text-[11px] text-muted">
              Digits
            </label>
            <select
              id="rename-pad"
              value={renameOptions.zeroPad}
              onChange={(e) =>
                setRenameOptions((prev) => ({ ...prev, zeroPad: Number(e.target.value) }))
              }
              className="w-full rounded-control border border-border bg-well px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value={1}>1 (1)</option>
              <option value={2}>2 (01)</option>
              <option value={3}>3 (001)</option>
              <option value={4}>4 (0001)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 items-center">
          <select
            aria-label="Filename case style"
            value={renameOptions.caseMode}
            onChange={(e) =>
              setRenameOptions((prev) => ({
                ...prev,
                caseMode: e.target.value as BatchRenameCase,
              }))
            }
            className="rounded-control border border-border bg-well px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="preserve">Keep Case</option>
            <option value="lower">lowercase</option>
            <option value="upper">UPPERCASE</option>
            <option value="kebab">kebab-case</option>
            <option value="snake">snake_case</option>
          </select>

          <label className="flex cursor-pointer items-center justify-end gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={renameOptions.preserveExtension}
              onChange={(e) =>
                setRenameOptions((prev) => ({
                  ...prev,
                  preserveExtension: e.target.checked,
                }))
              }
              className="h-3.5 w-3.5 cursor-pointer accent-primary"
            />
            <span>Keep ext</span>
          </label>
        </div>

        {renamePreview.length > 0 && (
          <div
            data-testid="batch-rename-preview"
            className="space-y-1 rounded-control border border-border bg-well/70 px-2.5 py-2 font-mono text-[11px]"
          >
            {renamePreview.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 truncate">
                <span className="max-w-[42%] truncate text-muted">{item.oldName}</span>
                <span className="shrink-0 text-primary">→</span>
                <span className="truncate font-semibold text-foreground">{item.newName}</span>
              </div>
            ))}
            {renamePreview.length > 3 && (
              <div className="text-[10px] text-muted">
                +{renamePreview.length - 3} more file(s)
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          data-testid="batch-rename-apply-btn"
          disabled={disabled || (renamePreview.length > 0 && renamePreview.every((r) => r.oldName === r.newName))}
          onClick={() => onBatchRename({ ...renameOptions })}
          className="w-full min-h-9 cursor-pointer rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {renamePreview.length > 0 && renamePreview.every((r) => r.oldName === r.newName)
            ? `Applied to All (${imageCount})`
            : `Rename All (${imageCount})`}
        </button>
      </div>

      {/* 2. Batch Resize */}
      <div className="space-y-2.5 py-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Scaling className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Batch Resize All Images</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Batch resize mode"
            value={resizeMode}
            onChange={(e) => {
              const m = e.target.value as BatchResizeMode;
              setResizeMode(m);
              setResizeValue(m === 'percent' ? 75 : 800);
            }}
            className="rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          >
            <option value="max-edge">Max Edge (px)</option>
            <option value="width">Exact Width (px)</option>
            <option value="height">Exact Height (px)</option>
            <option value="percent">Scale (%)</option>
          </select>

          <input
            type="number"
            aria-label="Batch resize target value"
            min={resizeMode === 'percent' ? 5 : 32}
            max={resizeMode === 'percent' ? 400 : 6000}
            value={resizeValue}
            onChange={(e) => setResizeValue(Math.max(1, Number(e.target.value) || 100))}
            className="rounded-control border border-border bg-well px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onBatchResize(resizeMode, resizeValue)}
          className="w-full min-h-9 cursor-pointer rounded-control border border-border bg-foreground px-3 py-1.5 text-xs font-semibold text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? 'Processing...' : `Resize All (${imageCount})`}
        </button>
      </div>

      {/* 3. Batch Smart Aspect Crop & Orientation */}
      <div className="space-y-2.5 py-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Scissors className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Batch Focal Crop & Orientation</span>
        </div>

        <div className="flex gap-1.5">
          <select
            aria-label="Batch focal crop aspect ratio"
            value={cropPreset}
            onChange={(e) => setCropPreset(e.target.value as CropAspectPreset)}
            className="flex-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          >
            <option value="1:1">1:1 Square</option>
            <option value="4:3">4:3 Standard</option>
            <option value="16:9">16:9 Wide</option>
            <option value="3:2">3:2 Photo</option>
            <option value="3:4">3:4 Portrait</option>
            <option value="id-card">ID Card (85.6:54)</option>
          </select>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onBatchCropAspect(cropPreset)}
            className="min-h-8 cursor-pointer rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            Crop All
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onBatchCropAspect('reset')}
            className="min-h-8 cursor-pointer rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent-soft/60 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBatchTransform('rotate90')}
            className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-control border border-border bg-well px-2 text-[11px] font-medium text-foreground hover:bg-accent-soft/60 disabled:opacity-45"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            <span>Rotate 90°</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBatchTransform('flipH')}
            className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-control border border-border bg-well px-2 text-[11px] font-medium text-foreground hover:bg-accent-soft/60 disabled:opacity-45"
          >
            <FlipHorizontal2 className="h-3 w-3" aria-hidden="true" />
            <span>Flip H</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBatchTransform('flipV')}
            className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-control border border-border bg-well px-2 text-[11px] font-medium text-foreground hover:bg-accent-soft/60 disabled:opacity-45"
          >
            <FlipVertical2 className="h-3 w-3" aria-hidden="true" />
            <span>Flip V</span>
          </button>
        </div>
      </div>

      {/* 4. Batch Per-Image Watermarking */}
      <div className="space-y-2.5 pt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Stamp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Stamp Every Loaded Image</span>
        </div>

        <input
          type="text"
          aria-label="Batch watermark text"
          value={watermark.text}
          onChange={(e) => setWatermark((w) => ({ ...w, text: e.target.value }))}
          placeholder="Watermark text..."
          className="w-full rounded-control border border-border bg-well px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Batch watermark position"
            value={watermark.position}
            onChange={(e) =>
              setWatermark((w) => ({
                ...w,
                position: e.target.value as BatchWatermarkOptions['position'],
              }))
            }
            className="rounded-control border border-border bg-well px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="center">Center</option>
            <option value="tiled">Tiled Diagonal</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Batch watermark color"
              value={watermark.color}
              onChange={(e) => setWatermark((w) => ({ ...w, color: e.target.value }))}
              className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span className="font-mono text-xs text-muted">{watermark.opacity}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="mb-1 block text-[11px] text-muted">Size {watermark.fontSize}px</span>
            <input
              type="range"
              aria-label="Batch watermark font size"
              min={14}
              max={64}
              value={watermark.fontSize}
              onChange={(e) =>
                setWatermark((w) => ({ ...w, fontSize: Number(e.target.value) }))
              }
              className="studio-range w-full"
            />
          </div>
          <div>
            <span className="mb-1 block text-[11px] text-muted">Opacity {watermark.opacity}%</span>
            <input
              type="range"
              aria-label="Batch watermark opacity"
              min={15}
              max={100}
              value={watermark.opacity}
              onChange={(e) =>
                setWatermark((w) => ({ ...w, opacity: Number(e.target.value) }))
              }
              className="studio-range w-full"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || !watermark.text.trim()}
          onClick={() => onBatchWatermark({ ...watermark })}
          className="w-full min-h-9 cursor-pointer rounded-control border border-border bg-foreground px-3 py-1.5 text-xs font-semibold text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? 'Stamping...' : `Watermark All (${imageCount})`}
        </button>
      </div>
    </div>
  );
};
