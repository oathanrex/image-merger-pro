import React from 'react';
import { Camera, FileCode2, Palette } from 'lucide-react';
import type { ImageMetadataInfo, MergerImage } from '../types/merger';
import { formatAspectRatio, formatBytes, getEffectiveImageDimensions } from '../utils/canvasEngine';
import { extractMetadataFromDataUrl } from '../utils/imageMetadata';

interface MetadataInspectorPanelProps {
  image: MergerImage;
  index: number;
}

export const MetadataInspectorPanel: React.FC<MetadataInspectorPanelProps> = ({
  image,
  index,
}) => {
  const meta: ImageMetadataInfo = React.useMemo(() => {
    if (image.metadata) return image.metadata;
    return extractMetadataFromDataUrl(image.src, {
      fileName: image.name,
      fileSize: image.size,
      width: image.originalWidth ?? image.width,
      height: image.originalHeight ?? image.height,
    });
  }, [image]);

  const origW = image.originalWidth ?? meta.originalWidth ?? image.width;
  const origH = image.originalHeight ?? meta.originalHeight ?? image.height;
  const eff = getEffectiveImageDimensions(image);
  const dimsChanged = eff.width !== origW || eff.height !== origH;
  const origMp = ((origW * origH) / 1_000_000).toFixed(2);

  const exif = meta.exif || {};
  const cameraName = [exif.make, exif.model].filter(Boolean).join(' ');
  const exposureParts = [exif.exposureTime, exif.fNumber, exif.iso ? `ISO ${exif.iso}` : undefined, exif.focalLength].filter(Boolean);
  const hasExifTags = Boolean(
    cameraName ||
      exif.lensModel ||
      exposureParts.length > 0 ||
      exif.orientation ||
      exif.dateTime ||
      exif.software ||
      exif.gpsSummary,
  );

  const channelSummary = [
    meta.bitDepth,
    meta.colorType,
    meta.hasAlpha === true ? 'Alpha' : meta.hasAlpha === false ? 'Opaque' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      data-testid={`tray-metadata-panel-${index}`}
      aria-label={`Read-only metadata inspector for ${image.name}`}
      className="space-y-2.5 border-t border-border bg-well/40 px-3 py-2.5 text-[11px]"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">File & EXIF Metadata</span>
        <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
          Read-only
        </span>
      </div>

      {/* Original Resolution & File Container */}
      <div className="space-y-1 rounded-md border border-border/70 bg-surface p-2">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <FileCode2 className="h-3 w-3 text-primary" aria-hidden="true" />
          <span>Resolution & Container</span>
        </div>
        <MetaRow
          label="Original"
          value={`${origW}×${origH} px (${origMp} MP)`}
          mono
        />
        {dimsChanged && (
          <MetaRow
            label="Active"
            value={`${eff.width}×${eff.height} px`}
            mono
          />
        )}
        <MetaRow
          label="File"
          value={`${meta.format} · ${formatBytes(image.size)} · ${formatAspectRatio(origW, origH)}`}
          mono
        />
        {meta.dpi && <MetaRow label="Density" value={meta.dpi} mono />}
      </div>

      {/* Color Profile & Pixel Channels */}
      <div className="space-y-1 rounded-md border border-border/70 bg-surface p-2">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <Palette className="h-3 w-3 text-primary" aria-hidden="true" />
          <span>Color Profile</span>
        </div>
        <MetaRow label="Profile" value={meta.colorProfile} />
        {channelSummary && <MetaRow label="Channels" value={channelSummary} mono />}
        {exif.colorSpace && <MetaRow label="EXIF Space" value={exif.colorSpace} mono />}
      </div>

      {/* EXIF Camera / Capture Tags */}
      <div className="space-y-1 rounded-md border border-border/70 bg-surface p-2">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <Camera className="h-3 w-3 text-primary" aria-hidden="true" />
          <span>EXIF Data</span>
        </div>
        {hasExifTags ? (
          <>
            {cameraName && <MetaRow label="Camera" value={cameraName} />}
            {exif.lensModel && <MetaRow label="Lens" value={exif.lensModel} />}
            {exposureParts.length > 0 && (
              <MetaRow label="Exposure" value={exposureParts.join(' · ')} mono />
            )}
            {exif.orientation && <MetaRow label="Orientation" value={exif.orientation} />}
            {exif.dateTime && <MetaRow label="Captured" value={exif.dateTime} mono />}
            {exif.software && <MetaRow label="Software" value={exif.software} />}
            {exif.gpsSummary && <MetaRow label="Location" value={exif.gpsSummary} mono />}
          </>
        ) : (
          <p className="text-[11px] text-muted">
            No camera EXIF block embedded in this file.
          </p>
        )}
      </div>
    </div>
  );
};

const MetaRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="flex items-start justify-between gap-2">
    <span className="shrink-0 text-muted">{label}</span>
    <span
      title={value}
      className={`min-w-0 break-words text-right text-foreground ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}
    >
      {value}
    </span>
  </div>
);
