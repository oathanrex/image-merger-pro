import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastItem } from '../types/merger';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const toneClasses =
          toast.type === 'error'
            ? 'border-danger/40 bg-surface text-foreground'
            : toast.type === 'warning'
              ? 'border-warning/40 bg-surface text-foreground'
              : 'border-primary/40 bg-surface text-foreground';

        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? XCircle
              : toast.type === 'warning'
                ? AlertTriangle
                : Info;

        const iconColor =
          toast.type === 'error'
            ? 'text-danger'
            : toast.type === 'warning'
              ? 'text-warning'
              : 'text-primary';

        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center gap-3 rounded-card border px-4 py-3 shadow-lg ${toneClasses}`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-well hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
