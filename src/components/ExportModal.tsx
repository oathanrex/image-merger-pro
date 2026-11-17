import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bookmark,
  Copy,
  Download,
  FileText,
  Gauge,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ExportDimensionMode,
  ExportDimensionsConfig,
  ExportPreset,
  MergerImage,
  MergerSettings,
  OutputFormat,
  OutputStats,
} from '../types/merger';
import {
  calcPrintSizeInches,
  computeExportDimensions,
  formatBytes,
} from '../utils/canvasEngine';

interface ExportModalProps {
  open: boolean;
  images: MergerImage[];
  settings: MergerSettings;
  outputStats: OutputStats;
  exportDimensions: ExportDimensionsConfig;
  exportPresets: ExportPreset[];
  onClose: () => void;
  onUpdateSettings: (patch: Partial<MergerSettings>, commitHistory?: boolean) => void;
  onUpdateExportDimensions: (patch: Partial<ExportDimensionsConfig>) => void;
  onSaveExportPreset: (preset: Omit<ExportPreset, 'id' | 'createdAt'>) => void;
  onApplyExportPreset: (preset: ExportPreset) => void;
  onDeleteExportPreset: (id: string) => void;
  onDownloadStandard: () => Promise<void>;
  onDownloadBatchZip: () => Promise<void>;
  onDownloadTargetKb: (targetKb: number, format: 'jpeg' | 'webp') => Promise<string>;
  onDownloadPdf: () => Promise<void>;
  onCopyToClipboard: () => Promise<void>;
}

const BUILTIN_EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'builtin-lossless',
    name: 'Lossless Master',
    createdAt: 0,
    format: 'png',
    quality: 100,
    transparentBg: false,
    dimensionMode: 'canvas',
    maxWidth: 1920,
    maxHeight: 1080,
    customScale: 100,
    isBuiltIn: true,
  },
  {
    id: 'builtin-web-hero',
    name: 'Web Hero HD',
    createdAt: 0,
    format: 'webp',
    quality: 85,
    transparentBg: false,
    dimensionMode: 'fit-box',
    maxWidth: 1920,
    maxHeight: 1080,
    customScale: 100,
    isBuiltIn: true,
  },
  {
    id: 'builtin-social-square',
    name: 'Social 1080px',
    createdAt: 0,
    format: 'jpeg',
    quality: 90,
    transparentBg: false,
    dimensionMode: 'fit-box',
    maxWidth: 1080,
    maxHeight: 1080,
    customScale: 100,
    isBuiltIn: true,
  },
  {
    id: 'builtin-portal-200kb',
    name: 'Portal ≤200 KB',
    createdAt: 0,
    format: 'jpeg',
    quality: 80,
    transparentBg: false,
    targetKb: 200,
    dimensionMode: 'fit-box',
    maxWidth: 1200,
    maxHeight: 1200,
    customScale: 100,
    isBuiltIn: true,
  },
];

function describeExportPreset(preset: ExportPreset): string {
  const fmt = preset.format.toUpperCase();
  const comp = preset.format === 'png' ? 'Lossless' : `${preset.quality}%`;
  const dim =
    preset.dimensionMode === 'fit-box'
      ? `≤${preset.maxWidth}×${preset.maxHeight}`
      : preset.dimensionMode === 'custom-scale'
        ? `${preset.customScale}%`
        : 'Native';
  const kb = preset.targetKb ? ` · ≤${preset.targetKb}KB` : '';
  return `${fmt} · ${comp} · ${dim}${kb}`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  images,
  settings,
  outputStats,
  exportDimensions,
  exportPresets,
  onClose,
  onUpdateSettings,
  onUpdateExportDimensions,
  onSaveExportPreset,
  onApplyExportPreset,
  onDeleteExportPreset,
  onDownloadStandard,
  onDownloadBatchZip,
  onDownloadTargetKb,
  onDownloadPdf,
  onCopyToClipboard,
}) => {
  const [targetKb, setTargetKb] = useState(200);
  const [targetFormat, setTargetFormat] = useState<'jpeg' | 'webp'>(
    settings.format === 'webp' ? 'webp' : 'jpeg',
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [optimizerSummary, setOptimizerSummary] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [includeKbCapInPreset, setIncludeKbCapInPreset] = useState(false);

  const resolvedDims = useMemo(
    () => computeExportDimensions(outputStats.width, outputStats.height, exportDimensions),
    [outputStats.width, outputStats.height, exportDimensions],
  );

  const resolvedMp = useMemo(() => {
    if (resolvedDims.width <= 0 || resolvedDims.height <= 0) return '0.00';
    return ((resolvedDims.width * resolvedDims.height) / 1_000_000).toFixed(2);
  }, [resolvedDims.width, resolvedDims.height]);

  useEffect(() => {
    if (open) {
      setOptimizerSummary(null);
      setTargetFormat(settings.format === 'webp' ? 'webp' : 'jpeg');
    }
  }, [open, settings.format]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const handleTargetOptimize = async () => {
    setBusyAction('optimize');
    try {
      const summary = await onDownloadTargetKb(targetKb, targetFormat);
      setOptimizerSummary(summary);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectPreset = (preset: ExportPreset) => {
    onApplyExportPreset(preset);
    if (preset.targetKb) {
      setTargetKb(preset.targetKb);
      setIncludeKbCapInPreset(true);
    }
    if (preset.format === 'jpeg' || preset.format === 'webp') {
      setTargetFormat(preset.format);
    }
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = presetName.trim();
    if (!clean) return;
    onSaveExportPreset({
      name: clean,
      format: settings.format,
      quality: settings.quality,
      transparentBg: settings.transparentBg,
      targetKb: includeKbCapInPreset ? targetKb : undefined,
      dimensionMode: exportDimensions.dimensionMode,
      maxWidth: exportDimensions.maxWidth,
      maxHeight: exportDimensions.maxHeight,
      customScale: exportDimensions.customScale,
      filenamePrefix: settings.filenamePrefix,
    });
    setPresetName('');
  };

  const allPresets = [...exportPresets, ...BUILTIN_EXPORT_PRESETS];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2
              id="export-modal-title"
              className="font-display text-lg font-bold text-foreground"
            >
              Export Merged Composition
            </h2>
            <p
              data-testid="export-dimensions-readout"
              className="mt-0.5 font-mono text-xs text-muted tabular-nums"
            >
              {resolvedDims.width} × {resolvedDims.height} px · {resolvedMp} MP
              {resolvedDims.scaled
                ? ` (scaled from ${outputStats.width}×${outputStats.height})`
                : ''}{' '}
              ·{' '}
              {!resolvedDims.scaled && outputStats.estimatedBytes !== null
                ? formatBytes(outputStats.estimatedBytes)
                : 'Ready'}{' '}
              · 300 DPI ({calcPrintSizeInches(resolvedDims.width, resolvedDims.height, 300)})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="cursor-pointer rounded-control p-1.5 text-muted hover:bg-well hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Export Presets Section */}
        <div
          data-testid="export-presets-section"
          className="mt-4 space-y-3 border-b border-border pb-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-foreground">
                Export Presets (Format, Compression & Dimensions)
              </h3>
            </div>
            <span className="font-mono text-[11px] text-muted">
              {exportPresets.length} custom · {BUILTIN_EXPORT_PRESETS.length} built-in
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-testid="export-presets-list">
            {allPresets.map((preset) => {
              const isSelected =
                settings.format === preset.format &&
                (preset.format === 'png' || settings.quality === preset.quality) &&
                exportDimensions.dimensionMode === preset.dimensionMode &&
                (preset.dimensionMode !== 'fit-box' ||
                  (exportDimensions.maxWidth === preset.maxWidth &&
                    exportDimensions.maxHeight === preset.maxHeight)) &&
                (preset.dimensionMode !== 'custom-scale' ||
                  exportDimensions.customScale === preset.customScale);

              return (
                <div
                  key={preset.id}
                  data-testid={`export-preset-item-${preset.id}`}
                  className={`flex items-center justify-between gap-2 rounded-control border px-2.5 py-1.5 transition-colors ${
                    isSelected
                      ? 'border-primary bg-accent-soft/60'
                      : 'border-border bg-well/60 hover:border-primary/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {preset.name}
                      </span>
                      {!preset.isBuiltIn && (
                        <span className="rounded bg-primary/15 px-1 py-0.5 font-mono text-[9px] font-semibold text-primary">
                          Saved
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-muted">
                      {describeExportPreset(preset)}
                    </div>
                  </button>

                  {!preset.isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => onDeleteExportPreset(preset.id)}
                      aria-label={`Delete export preset ${preset.name}`}
                      className="shrink-0 cursor-pointer rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreatePreset} className="flex flex-wrap items-center gap-2">
            <input
              id="export-preset-name-input"
              name="exportPresetName"
              type="text"
              data-testid="export-preset-name-input"
              aria-label="New export preset name"
              placeholder="Save current settings as preset (e.g. Blog WebP 1200)..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="min-w-[180px] flex-1 rounded-control border border-border bg-well px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <label htmlFor="include-kb-cap-checkbox" className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
              <input
                id="include-kb-cap-checkbox"
                name="includeKbCap"
                type="checkbox"
                checked={includeKbCapInPreset}
                onChange={(e) => setIncludeKbCapInPreset(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span>Include ≤{targetKb}KB cap</span>
            </label>
            <button
              type="submit"
              data-testid="save-export-preset-btn"
              disabled={!presetName.trim()}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save Preset</span>
            </button>
          </form>
        </div>

        {/* Format, Quality & Output Dimensions */}
        <div className="mt-4 space-y-4 border-b border-border pb-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="export-format-select"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                File Format
              </label>
              <select
                id="export-format-select"
                name="exportFormat"
                data-testid="export-format-select"
                value={settings.format}
                onChange={(e) => {
                  const fmt = e.target.value as OutputFormat;
                  onUpdateSettings(
                    {
                      format: fmt,
                      transparentBg: fmt === 'jpeg' ? false : settings.transparentBg,
                    },
                    true,
                  );
                }}
                className="w-full rounded-control border border-border bg-well px-3 py-2 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="png">PNG (Lossless / Transparency)</option>
                <option value="jpeg">JPEG (Compact Photo / Portal)</option>
                <option value="webp">WebP (Modern Web Optimized)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="export-prefix-input"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Filename Prefix
              </label>
              <input
                id="export-prefix-input"
                name="exportPrefix"
                data-testid="export-prefix-input"
                type="text"
                value={settings.filenamePrefix}
                onChange={(e) =>
                  onUpdateSettings({ filenamePrefix: e.target.value }, false)
                }
                className="w-full rounded-control border border-border bg-well px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {settings.format !== 'png' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <label
                  htmlFor="export-quality-slider"
                  className="font-semibold text-foreground"
                >
                  Encoding Quality
                </label>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {settings.quality}%
                </span>
              </div>
              <input
                id="export-quality-slider"
                name="exportQuality"
                data-testid="export-quality-slider"
                type="range"
                min={10}
                max={100}
                value={settings.quality}
                onChange={(e) =>
                  onUpdateSettings({ quality: Number(e.target.value) }, false)
                }
                className="studio-range w-full"
              />
            </div>
          )}

          {/* Export Output Dimensions */}
          <div className="space-y-2.5 rounded-control border border-border bg-well/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                Output Dimensions
              </span>
              <span className="font-mono text-[11px] text-primary tabular-nums">
                {resolvedDims.width} × {resolvedDims.height} px
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-control bg-well p-1">
              {(
                [
                  { id: 'canvas', label: 'Canvas Native' },
                  { id: 'fit-box', label: 'Max Box (W×H)' },
                  { id: 'custom-scale', label: 'Scale %' },
                ] as const
              ).map((opt) => {
                const active = exportDimensions.dimensionMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`export-dim-mode-${opt.id}`}
                    onClick={() =>
                      onUpdateExportDimensions({
                        dimensionMode: opt.id as ExportDimensionMode,
                      })
                    }
                    className={`min-h-8 cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-surface text-primary shadow-surface'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {exportDimensions.dimensionMode === 'fit-box' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="export-max-width"
                    className="mb-1 block text-[11px] text-muted"
                  >
                    Max Width (px)
                  </label>
                  <input
                    id="export-max-width"
                    name="exportMaxWidth"
                    data-testid="export-max-width"
                    type="number"
                    min={64}
                    max={8000}
                    value={exportDimensions.maxWidth}
                    onChange={(e) =>
                      onUpdateExportDimensions({
                        maxWidth: Math.max(64, Math.min(8000, Number(e.target.value) || 1920)),
                      })
                    }
                    className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="export-max-height"
                    className="mb-1 block text-[11px] text-muted"
                  >
                    Max Height (px)
                  </label>
                  <input
                    id="export-max-height"
                    name="exportMaxHeight"
                    data-testid="export-max-height"
                    type="number"
                    min={64}
                    max={8000}
                    value={exportDimensions.maxHeight}
                    onChange={(e) =>
                      onUpdateExportDimensions({
                        maxHeight: Math.max(64, Math.min(8000, Number(e.target.value) || 1080)),
                      })
                    }
                    className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {exportDimensions.dimensionMode === 'custom-scale' && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="export-custom-scale" className="text-muted">
                    Export Scale
                  </label>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {exportDimensions.customScale}%
                  </span>
                </div>
                <input
                  id="export-custom-scale"
                  name="exportCustomScale"
                  data-testid="export-custom-scale"
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={exportDimensions.customScale}
                  onChange={(e) =>
                    onUpdateExportDimensions({
                      customScale: Number(e.target.value),
                    })
                  }
                  className="studio-range w-full"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('download', onDownloadStandard)}
              className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>
                {busyAction === 'download'
                  ? 'Rendering...'
                  : `Download ${settings.format.toUpperCase()}`}
              </span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('pdf', onDownloadPdf)}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-well disabled:opacity-50 whitespace-nowrap"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>{busyAction === 'pdf' ? 'Building PDF...' : 'Export PDF'}</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('copy', onCopyToClipboard)}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-well disabled:opacity-50 whitespace-nowrap"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>{busyAction === 'copy' ? 'Copying...' : 'Copy PNG'}</span>
            </button>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-control border border-border bg-well/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">
                  Export Processed Individual Images (.zip)
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                  {images
                    .slice(0, 3)
                    .map((im) => im.name)
                    .join(', ')}
                  {images.length > 3 ? ` +${images.length - 3} more` : ''}
                </div>
              </div>
              <button
                type="button"
                data-testid="export-batch-zip-btn"
                disabled={busyAction !== null}
                onClick={() => runAction('zip', onDownloadBatchZip)}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-primary/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {busyAction === 'zip'
                    ? 'Packing ZIP...'
                    : `Download ZIP (${images.length})`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Target File Size Optimizer */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Compress Under Exact KB Limit
            </h3>
          </div>
          <p className="text-xs text-muted">
            Ideal for government portals and upload forms with strict KB caps. Automatically binary-searches optimal quality and scale.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {[50, 100, 200, 500].map((presetKb) => (
              <button
                key={presetKb}
                type="button"
                onClick={() => setTargetKb(presetKb)}
                className={`cursor-pointer rounded-control border px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                  targetKb === presetKb
                    ? 'border-primary bg-accent-soft text-primary'
                    : 'border-border bg-well text-foreground hover:bg-accent-soft/50'
                }`}
              >
                {presetKb} KB
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="target-kb-input" className="sr-only">
              Target maximum file size in kilobytes
            </label>
            <input
              id="target-kb-input"
              name="targetKb"
              type="number"
              min={10}
              max={10000}
              value={targetKb}
              onChange={(e) => setTargetKb(Math.max(10, Number(e.target.value) || 100))}
              className="w-28 rounded-control border border-border bg-well px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-xs font-medium text-muted">KB max</span>

            <select
              id="target-compression-format"
              name="targetCompressionFormat"
              aria-label="Target compression format"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as 'jpeg' | 'webp')}
              className="rounded-control border border-border bg-well px-3 py-2 text-xs font-semibold uppercase text-foreground focus:border-primary focus:outline-none"
            >
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleTargetOptimize}
              className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control bg-foreground px-4 py-2 text-xs font-semibold text-surface hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {busyAction === 'optimize' ? 'Optimizing...' : `Optimize & Download ≤ ${targetKb} KB`}
              </span>
            </button>
          </div>

          {optimizerSummary && (
            <p className="rounded-control border border-primary/30 bg-accent-soft px-3 py-2 text-xs font-medium text-primary">
              {optimizerSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
