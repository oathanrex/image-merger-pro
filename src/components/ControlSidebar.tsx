import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  Crosshair,
  Grid3X3,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AlignmentMode,
  BatchRenameOptions,
  BatchResizeMode,
  BatchWatermarkOptions,
  CropAspectPreset,
  ImageFilters,
  LayoutMode,
  MergerImage,
  MergerSettings,
  OutputFormat,
  ScaleMode,
  SmartAlignmentMode,
  TextStampPosition,
  UserPreset,
} from '../types/merger';
import { BatchPanel } from './BatchPanel';

interface ControlSidebarProps {
  images: MergerImage[];
  selectedImageIds: string[];
  settings: MergerSettings;
  userPresets: UserPreset[];
  imageCount: number;
  batchBusy: boolean;
  onSelectAllImages: () => void;
  onClearSelection: () => void;
  onAutoArrange: () => void;
  onSmartAlign: (mode: SmartAlignmentMode) => void;
  onUpdateSettings: (patch: Partial<MergerSettings>, commitHistory?: boolean) => void;
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: UserPreset) => void;
  onDeletePreset: (id: string) => void;
  onBatchRename: (options: BatchRenameOptions) => void;
  onBatchApplyFilters: (filters: ImageFilters) => void;
  onBatchColorAdjust: (patch: Partial<ImageFilters>) => void;
  onBatchSharpen: (strength: number) => void;
  onBatchResize: (mode: BatchResizeMode, value: number) => Promise<void>;
  onBatchWatermark: (options: BatchWatermarkOptions) => Promise<void>;
  onBatchCropAspect: (preset: CropAspectPreset | 'reset') => void;
  onBatchTransform: (action: 'rotate90' | 'flipH' | 'flipV') => Promise<void>;
}

type SidebarTab = 'layout' | 'style' | 'batch' | 'presets';

const BUILTIN_SPECS: Array<{
  id: string;
  label: string;
  desc: string;
  patch: Partial<MergerSettings>;
}> = [
  {
    id: 'portal-id',
    label: 'ID Card / Document Stitch',
    desc: 'Horizontal · Same height · White frame · JPEG',
    patch: {
      layout: 'horizontal',
      scaleMode: 'same-height',
      spacing: 24,
      padding: 24,
      bgColor: '#ffffff',
      transparentBg: false,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      cornerRadius: 10,
      shadowBlur: 10,
      format: 'jpeg',
      quality: 90,
    },
  },
  {
    id: 'transparent-strip',
    label: 'Transparent Asset Strip',
    desc: 'Horizontal · Original size · Transparent PNG',
    patch: {
      layout: 'horizontal',
      scaleMode: 'original',
      spacing: 16,
      padding: 0,
      transparentBg: true,
      borderWidth: 0,
      cornerRadius: 0,
      shadowBlur: 0,
      format: 'png',
    },
  },
  {
    id: 'collage-grid',
    label: 'Balanced 2×2 Collage',
    desc: 'Grid 2 cols · Fit smallest · Rounded corners',
    patch: {
      layout: 'grid',
      autoColumns: false,
      columns: 2,
      scaleMode: 'fit-smallest',
      spacing: 16,
      padding: 20,
      bgColor: '#f8fafc',
      transparentBg: false,
      borderWidth: 0,
      cornerRadius: 14,
      shadowBlur: 8,
      format: 'png',
    },
  },
  {
    id: 'vertical-reel',
    label: 'Vertical Scroll Stack',
    desc: 'Vertical · Same width · Zero gap · WebP',
    patch: {
      layout: 'vertical',
      scaleMode: 'same-width',
      spacing: 0,
      padding: 0,
      bgColor: '#ffffff',
      transparentBg: false,
      borderWidth: 0,
      cornerRadius: 0,
      shadowBlur: 0,
      format: 'webp',
      quality: 92,
    },
  },
];

const STAMP_POSITIONS: Array<{ value: TextStampPosition; label: string }> = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  images,
  selectedImageIds,
  settings,
  userPresets,
  imageCount,
  batchBusy,
  onSelectAllImages,
  onClearSelection,
  onAutoArrange,
  onSmartAlign,
  onUpdateSettings,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onBatchRename,
  onBatchApplyFilters,
  onBatchColorAdjust,
  onBatchSharpen,
  onBatchResize,
  onBatchWatermark,
  onBatchCropAspect,
  onBatchTransform,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('layout');
  const [presetName, setPresetName] = useState('');
  const [smartAlignMode, setSmartAlignMode] = useState<SmartAlignmentMode>('focal-lineup');

  const layouts: Array<{ value: LayoutMode; label: string; icon: React.ReactNode }> = [
    { value: 'horizontal', label: 'Horizontal', icon: <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> },
    { value: 'vertical', label: 'Vertical', icon: <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> },
    { value: 'grid', label: 'Grid', icon: <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" /> },
    { value: 'overlay', label: 'Overlay', icon: <Layers className="h-3.5 w-3.5" aria-hidden="true" /> },
  ];

  const alignments: Array<{ value: AlignmentMode; label: string }> = [
    { value: 'start', label: 'Start' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'End' },
  ];

  const handleLayoutKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = layouts[(idx + 1) % layouts.length].value;
      onUpdateSettings({ layout: next }, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = layouts[(idx - 1 + layouts.length) % layouts.length].value;
      onUpdateSettings({ layout: prev }, true);
    }
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = presetName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed);
    setPresetName('');
  };

  return (
    <aside
      aria-label="Canvas inspector settings"
      className="flex flex-col rounded-card border border-border bg-surface shadow-surface"
    >
      {/* Inspector Tab Switcher */}
      <div
        role="tablist"
        aria-label="Inspector sections"
        className="grid grid-cols-4 gap-1 border-b border-border p-2"
      >
        {(
          [
            { id: 'layout', label: 'Layout' },
            { id: 'style', label: 'Style' },
            { id: 'batch', label: 'Batch' },
            { id: 'presets', label: 'Presets' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-9 cursor-pointer rounded-control px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted hover:bg-well hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Inspector Content */}
      <div className="flex flex-col divide-y divide-border/60 p-4">
        {activeTab === 'layout' && (
          <>
            {/* Layout Mode */}
            <div className="pb-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Layout Mode
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Layout mode selection"
                className="grid grid-cols-2 gap-1.5 rounded-control bg-well p-1"
              >
                {layouts.map((item, idx) => {
                  const active = settings.layout === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onUpdateSettings({ layout: item.value }, true)}
                      onKeyDown={(e) => handleLayoutKeyDown(e, idx)}
                      className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-surface text-primary shadow-surface'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="sidebar-auto-arrange-btn"
                disabled={imageCount === 0}
                onClick={onAutoArrange}
                title="Automatically calculate optimal spacing, padding, columns, and scaling for the active layout"
                className="mt-2.5 flex w-full min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-primary/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Auto-Arrange {settings.layout.charAt(0).toUpperCase() + settings.layout.slice(1)}</span>
              </button>
            </div>

            {/* Smart Content & Focal Alignment */}
            <div className="space-y-2.5 py-4" data-testid="smart-alignment-section">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Smart Alignment
                </span>
                <span className="font-mono text-[10px] text-muted">
                  Edge & Focal AI
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Smart alignment strategy"
                className="grid grid-cols-3 gap-1 rounded-control bg-well p-1"
              >
                {(
                  [
                    { id: 'focal-lineup', label: 'Focal Axis' },
                    { id: 'edge-snap', label: 'Edge Snap' },
                    { id: 'focal-cluster', label: 'Cluster' },
                  ] as const
                ).map((opt) => {
                  const active = smartAlignMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`smart-align-mode-${opt.id}`}
                      onClick={() => setSmartAlignMode(opt.id)}
                      className={`min-h-8 cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
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

              <p className="text-[11px] leading-snug text-muted">
                {smartAlignMode === 'focal-lineup'
                  ? 'Aligns each image by its detected focal centroid along a shared subject line.'
                  : smartAlignMode === 'edge-snap'
                    ? 'Detects active content bounds, ignores blank margins, and snaps real edges.'
                    : 'Anchors the strongest focal image centrally with edge-balanced satellites.'}
              </p>

              <button
                type="button"
                data-testid="smart-align-btn"
                disabled={imageCount === 0}
                onClick={() => onSmartAlign(smartAlignMode)}
                className="flex w-full min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Smart Align Images</span>
              </button>
            </div>

            {/* Alignment (for Horizontal & Vertical) */}
            {(settings.layout === 'horizontal' || settings.layout === 'vertical') && (
              <div className="py-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Cross-Axis Alignment
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Image alignment"
                  className="grid grid-cols-3 gap-1 rounded-control bg-well p-1"
                >
                  {alignments.map((a) => {
                    const active = settings.alignment === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onUpdateSettings({ alignment: a.value }, true)}
                        className={`min-h-[34px] cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-surface text-primary shadow-surface'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grid Config */}
            {settings.layout === 'grid' && (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auto-columns-toggle"
                    className="cursor-pointer text-xs font-semibold text-foreground"
                  >
                    Auto Columns (√N)
                  </label>
                  <input
                    id="auto-columns-toggle"
                    type="checkbox"
                    checked={settings.autoColumns}
                    onChange={(e) => onUpdateSettings({ autoColumns: e.target.checked }, true)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label htmlFor="columns-slider" className="text-muted">
                      Manual Columns
                    </label>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {settings.columns}
                    </span>
                  </div>
                  <input
                    id="columns-slider"
                    type="range"
                    min={1}
                    max={12}
                    disabled={settings.autoColumns}
                    value={settings.columns}
                    onChange={(e) =>
                      onUpdateSettings({ columns: Number(e.target.value) }, false)
                    }
                    className="studio-range w-full disabled:opacity-45"
                  />
                </div>
              </div>
            )}

            {/* Spacing & Outer Padding */}
            <div className="space-y-3.5 py-4">
              {settings.layout !== 'overlay' && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label
                      htmlFor="spacing-slider"
                      className="font-semibold text-foreground"
                    >
                      Image Gap
                    </label>
                    <span className="font-mono text-muted tabular-nums">
                      {settings.spacing} px
                    </span>
                  </div>
                  <input
                    id="spacing-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={settings.spacing}
                    onChange={(e) =>
                      onUpdateSettings({ spacing: Number(e.target.value) }, false)
                    }
                    className="studio-range w-full"
                  />
                </div>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="padding-slider"
                    className="font-semibold text-foreground"
                  >
                    Canvas Padding
                  </label>
                  <span className="font-mono text-muted tabular-nums">
                    {settings.padding} px
                  </span>
                </div>
                <input
                  id="padding-slider"
                  type="range"
                  min={0}
                  max={120}
                  value={settings.padding}
                  onChange={(e) =>
                    onUpdateSettings({ padding: Number(e.target.value) }, false)
                  }
                  className="studio-range w-full"
                />
              </div>
            </div>

            {/* Scale Mode */}
            {settings.layout !== 'overlay' && (
              <div className="space-y-3 pt-4">
                <div>
                  <label
                    htmlFor="scale-mode-select"
                    className="mb-1.5 block text-xs font-semibold text-foreground"
                  >
                    Image Scale Mode
                  </label>
                  <select
                    id="scale-mode-select"
                    value={settings.scaleMode}
                    onChange={(e) =>
                      onUpdateSettings({ scaleMode: e.target.value as ScaleMode }, true)
                    }
                    className="w-full rounded-control border border-border bg-well px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="original">Original size</option>
                    <option value="fit-smallest">Fit to smallest</option>
                    <option value="fit-largest">Fit to largest</option>
                    <option value="same-height">Same height</option>
                    <option value="same-width">Same width</option>
                    <option value="custom">Custom scale %</option>
                  </select>
                </div>

                {settings.scaleMode === 'custom' && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <label htmlFor="custom-scale-slider" className="text-muted">
                        Custom Scale
                      </label>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {settings.customScale}%
                      </span>
                    </div>
                    <input
                      id="custom-scale-slider"
                      type="range"
                      min={10}
                      max={200}
                      value={settings.customScale}
                      onChange={(e) =>
                        onUpdateSettings({ customScale: Number(e.target.value) }, false)
                      }
                      className="studio-range w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <>
            {/* Background */}
            <div className="space-y-3 pb-4">
              <span className="block text-xs font-semibold text-foreground">
                Canvas Background
              </span>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  aria-label="Background color"
                  disabled={settings.transparentBg}
                  value={settings.bgColor}
                  onChange={(e) => onUpdateSettings({ bgColor: e.target.value }, false)}
                  className="h-9 w-11 cursor-pointer rounded-md border border-border bg-transparent p-0.5 disabled:opacity-40"
                />
                <span className="font-mono text-xs uppercase text-muted">
                  {settings.transparentBg ? 'TRANSPARENT' : settings.bgColor}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {['#ffffff', '#f8fafc', '#0f172a', '#000000'].map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Set background color ${swatch}`}
                      onClick={() =>
                        onUpdateSettings({ bgColor: swatch, transparentBg: false }, true)
                      }
                      style={{ backgroundColor: swatch }}
                      className="h-5 w-5 cursor-pointer rounded border border-border"
                    />
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
                <span>Transparent Canvas (PNG / WebP)</span>
                <input
                  type="checkbox"
                  checked={settings.transparentBg}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onUpdateSettings(
                      {
                        transparentBg: checked,
                        format:
                          checked && settings.format === 'jpeg' ? 'png' : settings.format,
                      },
                      true,
                    );
                  }}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </label>
            </div>

            {/* Borders, Radius, Shadow */}
            <div className="space-y-3.5 py-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="border-width-slider"
                    className="font-semibold text-foreground"
                  >
                    Image Border
                  </label>
                  <span className="font-mono text-muted tabular-nums">
                    {settings.borderWidth} px
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    id="border-width-slider"
                    type="range"
                    min={0}
                    max={24}
                    value={settings.borderWidth}
                    onChange={(e) =>
                      onUpdateSettings({ borderWidth: Number(e.target.value) }, false)
                    }
                    className="studio-range flex-1"
                  />
                  <input
                    type="color"
                    aria-label="Border color"
                    value={settings.borderColor}
                    onChange={(e) => onUpdateSettings({ borderColor: e.target.value }, false)}
                    className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="corner-radius-slider"
                    className="font-semibold text-foreground"
                  >
                    Corner Radius
                  </label>
                  <span className="font-mono text-muted tabular-nums">
                    {settings.cornerRadius} px
                  </span>
                </div>
                <input
                  id="corner-radius-slider"
                  type="range"
                  min={0}
                  max={64}
                  value={settings.cornerRadius}
                  onChange={(e) =>
                    onUpdateSettings({ cornerRadius: Number(e.target.value) }, false)
                  }
                  className="studio-range w-full"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="shadow-blur-slider"
                    className="font-semibold text-foreground"
                  >
                    Drop Shadow
                  </label>
                  <span className="font-mono text-muted tabular-nums">
                    {settings.shadowBlur} px
                  </span>
                </div>
                <input
                  id="shadow-blur-slider"
                  type="range"
                  min={0}
                  max={40}
                  value={settings.shadowBlur}
                  onChange={(e) =>
                    onUpdateSettings({ shadowBlur: Number(e.target.value) }, false)
                  }
                  className="studio-range w-full"
                />
              </div>
            </div>

            {/* Text Watermark / Stamp */}
            <div className="space-y-3 pt-4">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Text Stamp / Watermark
                </span>
                <input
                  type="checkbox"
                  checked={settings.textStamp.enabled}
                  onChange={(e) =>
                    onUpdateSettings(
                      { textStamp: { ...settings.textStamp, enabled: e.target.checked } },
                      true,
                    )
                  }
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </label>

              {settings.textStamp.enabled && (
                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    aria-label="Watermark text"
                    value={settings.textStamp.text}
                    onChange={(e) =>
                      onUpdateSettings(
                        { textStamp: { ...settings.textStamp, text: e.target.value } },
                        false,
                      )
                    }
                    placeholder="Enter watermark or label..."
                    className="w-full rounded-control border border-border bg-well px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="stamp-position"
                        className="mb-1 block text-xs text-muted"
                      >
                        Position
                      </label>
                      <select
                        id="stamp-position"
                        value={settings.textStamp.position}
                        onChange={(e) =>
                          onUpdateSettings(
                            {
                              textStamp: {
                                ...settings.textStamp,
                                position: e.target.value as TextStampPosition,
                              },
                            },
                            true,
                          )
                        }
                        className="w-full rounded-control border border-border bg-well px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        {STAMP_POSITIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-muted">
                        Color
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Watermark color"
                          value={settings.textStamp.color}
                          onChange={(e) =>
                            onUpdateSettings(
                              {
                                textStamp: { ...settings.textStamp, color: e.target.value },
                              },
                              false,
                            )
                          }
                          className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                        />
                        <span className="font-mono text-xs text-muted">
                          {settings.textStamp.color}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted">Font Size</span>
                      <span className="font-mono text-foreground tabular-nums">
                        {settings.textStamp.fontSize} px
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="Watermark font size"
                      min={12}
                      max={120}
                      value={settings.textStamp.fontSize}
                      onChange={(e) =>
                        onUpdateSettings(
                          {
                            textStamp: {
                              ...settings.textStamp,
                              fontSize: Number(e.target.value),
                            },
                          },
                          false,
                        )
                      }
                      className="studio-range w-full"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted">Opacity</span>
                      <span className="font-mono text-foreground tabular-nums">
                        {settings.textStamp.opacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="Watermark opacity"
                      min={10}
                      max={100}
                      value={settings.textStamp.opacity}
                      onChange={(e) =>
                        onUpdateSettings(
                          {
                            textStamp: {
                              ...settings.textStamp,
                              opacity: Number(e.target.value),
                            },
                          },
                          false,
                        )
                      }
                      className="studio-range w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'batch' && (
          <BatchPanel
            images={images}
            selectedImageIds={selectedImageIds}
            imageCount={imageCount}
            busy={batchBusy}
            onSelectAllImages={onSelectAllImages}
            onClearSelection={onClearSelection}
            onBatchRename={onBatchRename}
            onBatchApplyFilters={onBatchApplyFilters}
            onBatchColorAdjust={onBatchColorAdjust}
            onBatchSharpen={onBatchSharpen}
            onBatchResize={onBatchResize}
            onBatchWatermark={onBatchWatermark}
            onBatchCropAspect={onBatchCropAspect}
            onBatchTransform={onBatchTransform}
          />
        )}

        {activeTab === 'presets' && (
          <>
            {/* Output Defaults */}
            <div className="space-y-3 pb-4">
              <span className="block text-xs font-semibold text-foreground">
                Output Format & Quality
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-control bg-well p-1">
                {(['png', 'jpeg', 'webp'] as OutputFormat[]).map((fmt) => {
                  const active = settings.format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() =>
                        onUpdateSettings(
                          {
                            format: fmt,
                            transparentBg: fmt === 'jpeg' ? false : settings.transparentBg,
                          },
                          true,
                        )
                      }
                      className={`min-h-[34px] cursor-pointer rounded-md text-xs font-semibold uppercase transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-surface text-primary shadow-surface'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="quality-slider" className="text-muted">
                    Compression Quality
                  </label>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {settings.format === 'png' ? 'Lossless' : `${settings.quality}%`}
                  </span>
                </div>
                <input
                  id="quality-slider"
                  type="range"
                  min={10}
                  max={100}
                  disabled={settings.format === 'png'}
                  value={settings.quality}
                  onChange={(e) =>
                    onUpdateSettings({ quality: Number(e.target.value) }, false)
                  }
                  className="studio-range w-full disabled:opacity-40"
                />
              </div>

              <div>
                <label
                  htmlFor="filename-prefix"
                  className="mb-1 block text-xs text-muted"
                >
                  Filename Prefix
                </label>
                <input
                  id="filename-prefix"
                  type="text"
                  value={settings.filenamePrefix}
                  onChange={(e) =>
                    onUpdateSettings({ filenamePrefix: e.target.value }, false)
                  }
                  className="w-full rounded-control border border-border bg-well px-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Built-in Recipes */}
            <div className="space-y-2 py-4">
              <span className="block text-xs font-semibold text-foreground">
                Built-in Specs
              </span>
              <div className="space-y-1.5">
                {BUILTIN_SPECS.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => onUpdateSettings(spec.patch, true)}
                    className="w-full cursor-pointer rounded-control border border-border bg-well/60 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-accent-soft/40"
                  >
                    <div className="text-xs font-semibold text-foreground">
                      {spec.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {spec.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save & Load Custom Presets */}
            <div className="space-y-3 pt-4">
              <span className="block text-xs font-semibold text-foreground">
                Your Saved Presets
              </span>
              <form onSubmit={handleCreatePreset} className="flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  aria-label="New preset name"
                  className="min-w-0 flex-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!presetName.trim()}
                  aria-label="Save current settings as preset"
                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-control bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Save</span>
                </button>
              </form>

              {userPresets.length === 0 ? (
                <p className="text-xs text-muted">
                  Save your favorite layout & export setup for instant reuse.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {userPresets.map((preset) => (
                    <li
                      key={preset.id}
                      className="flex items-center justify-between gap-2 rounded-control border border-border px-2.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyPreset(preset)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-xs font-medium text-foreground hover:text-primary"
                      >
                        <Bookmark className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{preset.name}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onApplyPreset(preset)}
                          aria-label={`Apply preset ${preset.name}`}
                          className="cursor-pointer rounded p-1 text-muted hover:bg-well hover:text-primary"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePreset(preset.id)}
                          aria-label={`Delete preset ${preset.name}`}
                          className="cursor-pointer rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
