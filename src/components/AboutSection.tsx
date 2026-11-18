import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  ChevronDown,
  HelpCircle,
  FileImage,
  Sliders,
  DownloadCloud,
  CheckCircle2,
} from 'lucide-react';

export const AboutSection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do I merge images side by side or vertically?',
      a: 'Simply upload or drag and drop your photos into Image Merger Pro. Select either "Horizontal" (side-by-side) or "Vertical" (stacked) from the layout options. Adjust spacing, borders, or alignment, and click "Export Image" to download.',
    },
    {
      q: 'Are my images uploaded to any remote server?',
      a: 'No. Image Merger Pro operates 100% locally in your web browser using HTML5 Canvas technology. Your photos never leave your device, ensuring complete security and privacy.',
    },
    {
      q: 'Can I export merged images without watermarks?',
      a: 'Yes, all exports in Image Merger Pro are 100% watermark-free, uncompressed, and completely free of charge in PNG, JPEG, WebP, or PDF formats.',
    },
    {
      q: 'What image formats are supported?',
      a: 'Image Merger Pro supports PNG, JPEG, WebP, GIF, SVG, and BMP files, and allows exporting to high-quality PNG, JPEG, WebP, and multi-page or single-sheet PDF.',
    },
    {
      q: 'Can I optimize the output image to a target file size (e.g., under 500 KB)?',
      a: 'Yes! In the Export Modal, you can specify an exact target size in Kilobytes (KB). The canvas engine automatically performs binary search compression to fit your exact budget.',
    },
    {
      q: 'Does it support batch editing and batch ZIP export?',
      a: 'Absolutely. You can apply filters, color adjustments, sharpening, watermarks, or crop aspect ratios to all images at once and download them as individual processed files in a single ZIP.',
    },
  ];

  return (
    <section className="mt-16 border-t border-border bg-surface/50 py-16 text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        {/* About Section Header */}
        <div id="about-section" className="scroll-mt-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Precision Canvas Engine</span>
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            About Image Merger Pro
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted">
            The free, private, and client-side photo stitching studio designed for creators,
            designers, developers, and everyday users who need clean composite graphics without
            cloud uploads or watermarks.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              100% Client-Side Privacy
            </h3>
            <p className="mt-2 text-sm text-muted">
              Zero server uploads. All pixel manipulation, resizing, cropping, and stitching happens
              directly inside your browser’s memory.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              4 Dynamic Layout Modes
            </h3>
            <p className="mt-2 text-sm text-muted">
              Seamlessly switch between Horizontal (Side-by-Side), Vertical (Stacked), Matrix Grid
              Collage, and Freeform Layered Overlay.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              Ultra-Fast Performance
            </h3>
            <p className="mt-2 text-sm text-muted">
              Powered by an optimized HTML5 Canvas render pipeline with hardware acceleration, batch
              transforms, and instant live preview.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              Completely Free & Clean
            </h3>
            <p className="mt-2 text-sm text-muted">
              No account required, no subscription paywalls, no artificial resolution limits, and zero
              annoying watermarks on your work.
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-16 rounded-2xl border border-border bg-surface p-8 sm:p-10">
          <div className="text-center">
            <h3 className="font-display text-2xl font-bold text-foreground">
              How to Merge Images in 3 Simple Steps
            </h3>
            <p className="mt-2 text-sm text-muted">
              Quickly create professional composite pictures without complex software.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                <FileImage className="h-6 w-6" />
              </div>
              <h4 className="mt-4 font-semibold text-foreground">1. Upload or Paste</h4>
              <p className="mt-1 text-xs text-muted">
                Drag and drop your images, browse local files, or paste directly from your clipboard (Ctrl+V).
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                <Sliders className="h-6 w-6" />
              </div>
              <h4 className="mt-4 font-semibold text-foreground">2. Arrange & Customize</h4>
              <p className="mt-1 text-xs text-muted">
                Choose horizontal, vertical, grid, or overlay layout. Adjust borders, spacing, rotation, filters, or crop.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                <DownloadCloud className="h-6 w-6" />
              </div>
              <h4 className="mt-4 font-semibold text-foreground">3. Export & Share</h4>
              <p className="mt-1 text-xs text-muted">
                Download your merged image in PNG, JPEG, WebP, or PDF format with custom quality and size targeting.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div id="faq-section" className="mt-16 scroll-mt-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Got Questions?</span>
            </div>
            <h3 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">
              Frequently Asked Questions (FAQ)
            </h3>
            <p className="mt-2 text-sm text-muted">
              Everything you need to know about merging photos, privacy, and export options.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between text-left font-medium text-foreground transition-colors hover:text-primary"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-primary' : 'text-muted'
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-3 text-xs leading-relaxed text-muted sm:text-sm">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
