import React from 'react';
import { Download } from 'lucide-react';

interface HeaderBarProps {
  imageCount: number;
  onOpenShortcuts: () => void;
  onOpenExport: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  imageCount,
  onOpenShortcuts,
  onOpenExport,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#studio-top"
          className="font-display text-lg font-bold tracking-tight text-foreground whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Image Merger Pro
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-muted"
        >
          <a
            href="#studio-top"
            className="whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Studio
          </a>
          <a
            href="#templates-section"
            className="whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Templates
          </a>
          <a
            href="#source-tray"
            className="whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Images
          </a>
          <a
            href="#about-section"
            className="whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            About
          </a>
          <a
            href="#faq-section"
            className="whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            FAQ
          </a>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="whitespace-nowrap shrink-0 cursor-pointer underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Shortcuts
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenExport}
            disabled={imageCount === 0}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export Image</span>
          </button>
        </div>
      </div>
    </header>
  );
};
