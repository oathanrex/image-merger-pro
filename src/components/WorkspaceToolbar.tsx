import React, { useRef } from 'react';
import {
  ClipboardPaste,
  FolderOpen,
  Moon,
  Redo2,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  HistorySnapshot,
  OutputStats,
  ThemeMode,
  WorkspaceTelemetry,
} from '../types/merger';
import { calcPrintSizeInches, formatBytes } from '../utils/canvasEngine';
import { HistoryDropdown } from './HistoryDropdown';

interface WorkspaceToolbarProps {
  imageCount: number;
  totalInputBytes: number;
  outputStats: OutputStats;
  formatLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  currentHistoryLabel: string;
  currentThumbnail?: string;
  theme: ThemeMode;
  telemetry: WorkspaceTelemetry;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistory: (target: { zone: 'past' | 'future'; index: number }) => void;
  onPasteClipboard: () => void;
  onToggleTheme: () => void;
  onSaveProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onResetSettings: () => void;
  onRequestClearAll: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  imageCount,
  totalInputBytes,
  outputStats,
  formatLabel,
  canUndo,
  canRedo,
  historyPast,
  historyFuture,
  currentHistoryLabel,
  currentThumbnail,
  theme,
  telemetry,
  onUndo,
  onRedo,
  onJumpToHistory,
  onPasteClipboard,
  onToggleTheme,
  onSaveProject,
  onLoadProjectFile,
  onResetSettings,
  onRequestClearAll,
}) => {
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleProjectSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadProjectFile(file);
    }
    e.target.value = '';
  };

  return (
    <section
      aria-label="Workspace tools and live output analytics"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-surface lg:flex-row lg:items-center lg:justify-between"
    >
      {/* Left: Real-Time Unboxed Analytics */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-foreground tabular-nums">
          {imageCount} {imageCount === 1 ? 'image' : 'images'}
        </span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <span className="font-mono tabular-nums">
          Input {formatBytes(totalInputBytes)}
        </span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <span className="font-mono font-medium text-foreground tabular-nums" data-testid="output-dimensions">
          {outputStats.width > 0
            ? `${outputStats.width} × ${outputStats.height} px`
            : '0 × 0 px'}
        </span>
        {outputStats.width > 0 && (
          <>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {outputStats.megapixels} MP ({outputStats.aspectRatio})
            </span>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {outputStats.estimating
                ? 'Estimating...'
                : outputStats.estimatedBytes !== null
                  ? `~${formatBytes(outputStats.estimatedBytes)} ${formatLabel.toUpperCase()}`
                  : formatLabel.toUpperCase()}
            </span>
            <span aria-hidden="true" className="hidden text-border sm:inline">
              ·
            </span>
            <span className="hidden font-mono text-muted tabular-nums sm:inline">
              300 DPI: {calcPrintSizeInches(outputStats.width, outputStats.height, 300)}
            </span>
          </>
        )}
        {telemetry.totalExports > 0 && (
          <>
            <span aria-hidden="true" className="hidden text-border xl:inline">
              ·
            </span>
            <span className="hidden text-muted tabular-nums xl:inline">
              {telemetry.totalExports} {telemetry.totalExports === 1 ? 'export' : 'exports'} saved
            </span>
          </>
        )}
      </div>

      {/* Right: Workspace Utility Controls */}
      <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo last action"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Undo</span>
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo action"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Redo</span>
        </button>

        <HistoryDropdown
          historyPast={historyPast}
          historyFuture={historyFuture}
          currentLabel={currentHistoryLabel}
          currentThumbnail={currentThumbnail}
          currentImageCount={imageCount}
          onUndo={onUndo}
          onRedo={onRedo}
          onJumpToHistory={onJumpToHistory}
        />

        <button
          type="button"
          onClick={onPasteClipboard}
          title="Paste image from clipboard (Ctrl+V)"
          aria-label="Paste image from clipboard"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Paste</span>
        </button>

        <button
          type="button"
          onClick={onSaveProject}
          disabled={imageCount === 0}
          title="Save workspace project (.json)"
          aria-label="Save project file"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Save</span>
        </button>

        <button
          type="button"
          onClick={() => projectInputRef.current?.click()}
          title="Load workspace project (.json)"
          aria-label="Open project file"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Open</span>
        </button>
        <input
          ref={projectInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleProjectSelect}
          className="hidden"
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onResetSettings}
          title="Reset layout and style settings to defaults"
          aria-label="Reset settings"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={onRequestClearAll}
          disabled={imageCount === 0}
          title="Clear all images"
          aria-label="Clear all images"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Clear</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-control border border-border bg-well p-1.5 text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 text-foreground" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
};
