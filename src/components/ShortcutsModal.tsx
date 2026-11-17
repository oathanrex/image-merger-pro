import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl / Cmd + V', action: 'Paste image directly from clipboard' },
  { keys: 'Ctrl / Cmd + Z', action: 'Undo last canvas or layer edit' },
  { keys: 'Ctrl / Cmd + Shift + Z', action: 'Redo previously undone edit' },
  { keys: 'Ctrl / Cmd + E', action: 'Open Export & Compression dialog' },
  { keys: '1 / 2 / 3 / 4', action: 'Switch between Horizontal, Vertical, Grid, Overlay' },
  { keys: 'A', action: 'Auto-arrange spacing & scaling for active layout' },
  { keys: 'R', action: 'Reset preview zoom & pan to Fit to View' },
  { keys: 'Arrow Keys (Shift)', action: 'Nudge selected Overlay layer by 1px (or 10px)' },
  { keys: '?', action: 'Toggle keyboard shortcuts reference' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2
              id="shortcuts-modal-title"
              className="font-display text-lg font-semibold text-foreground"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="cursor-pointer rounded-control p-1.5 text-muted hover:bg-well hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-border/60">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-foreground">{item.action}</span>
              <kbd className="rounded-control border border-border bg-well px-2.5 py-1 font-mono text-xs font-medium text-foreground whitespace-nowrap shrink-0">
                {item.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 cursor-pointer rounded-control bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
