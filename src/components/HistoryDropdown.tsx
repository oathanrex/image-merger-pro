import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, History, ImageOff, Redo2, Undo2 } from 'lucide-react';
import type { HistorySnapshot } from '../types/merger';

interface HistoryDropdownProps {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  currentLabel: string;
  currentThumbnail?: string;
  currentImageCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistory: (target: { zone: 'past' | 'future'; index: number }) => void;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export const HistoryDropdown: React.FC<HistoryDropdownProps> = ({
  historyPast,
  historyFuture,
  currentLabel,
  currentThumbnail,
  currentImageCount,
  onUndo,
  onRedo,
  onJumpToHistory,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const totalSaved = historyPast.length + historyFuture.length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Display future steps furthest-first -> nearest-next, then current, then past newest -> oldest
  const futureReversed = [...historyFuture].map((snap, idx) => ({ snap, idx })).reverse();
  const pastReversed = [...historyPast].map((snap, idx) => ({ snap, idx })).reverse();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="history-dropdown-btn"
        disabled={totalSaved === 0}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="Visual edit history timeline"
        aria-label="Open visual undo/redo history"
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed disabled:opacity-45 ${
          open
            ? 'border-primary bg-accent-soft text-primary'
            : 'border-border bg-well text-foreground hover:bg-accent-soft/60'
        }`}
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        <span>History</span>
        {totalSaved > 0 && (
          <span className="font-mono text-[11px] text-muted tabular-nums">
            ({totalSaved})
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Visual history timeline"
          data-testid="history-dropdown-panel"
          className="absolute right-0 top-full z-40 mt-2 w-80 sm:w-96 overflow-hidden rounded-card border border-border bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-well/50 px-3.5 py-2.5">
            <div className="min-w-0">
              <h3 className="font-display text-xs font-bold text-foreground">
                Visual Canvas History
              </h3>
              <p className="text-[11px] text-muted">
                Jump directly to any saved snapshot
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={historyPast.length === 0}
                onClick={onUndo}
                aria-label="Step backward in history"
                title="Undo"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-well disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={historyFuture.length === 0}
                onClick={onRedo}
                aria-label="Step forward in history"
                title="Redo"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-well disabled:opacity-40"
              >
                <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-80 divide-y divide-border/50 overflow-y-auto p-1.5">
            {/* Future (Redo) snapshots */}
            {futureReversed.map(({ snap, idx }) => (
              <button
                key={snap.id}
                type="button"
                data-testid={`history-future-item-${idx}`}
                onClick={() => onJumpToHistory({ zone: 'future', index: idx })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-left opacity-70 transition-colors hover:bg-well hover:opacity-100"
              >
                <ThumbnailBox src={snap.thumbnail} alt={snap.label} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {snap.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase text-muted">
                      Redo
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted tabular-nums">
                    <span>{snap.images.length} img</span>
                    <span aria-hidden="true">·</span>
                    <span>{snap.settings.layout}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatTime(snap.timestamp)}</span>
                  </div>
                </div>
              </button>
            ))}

            {/* Current Active Canvas State */}
            <div
              data-testid="history-current-item"
              className="flex items-center gap-2.5 rounded-control border border-primary/40 bg-accent-soft/60 px-2 py-2"
            >
              <ThumbnailBox src={currentThumbnail} alt="Current canvas state" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-foreground">
                    {currentLabel}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-primary">
                    Current
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">
                  {currentImageCount} {currentImageCount === 1 ? 'image' : 'images'} active
                </div>
              </div>
            </div>

            {/* Past (Undo) snapshots, newest first */}
            {pastReversed.map(({ snap, idx }) => (
              <button
                key={snap.id}
                type="button"
                data-testid={`history-past-item-${idx}`}
                onClick={() => onJumpToHistory({ zone: 'past', index: idx })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-well"
              >
                <ThumbnailBox src={snap.thumbnail} alt={snap.label} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {snap.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted tabular-nums">
                    <span>{snap.images.length} img</span>
                    <span aria-hidden="true">·</span>
                    <span>{snap.settings.layout}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatTime(snap.timestamp)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ThumbnailBox: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  if (!src) {
    return (
      <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded border border-border bg-well text-muted">
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-well p-0.5">
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    </div>
  );
};
