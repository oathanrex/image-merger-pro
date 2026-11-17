import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowLeftRight,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Info,
  Pencil,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { ImageFilters, MergerImage } from '../types/merger';
import {
  DEFAULT_FILTERS,
  MAX_IMAGES,
  buildCssFilterString,
  clamp,
  formatBytes,
  getEffectiveImageDimensions,
  normalizeDegrees,
} from '../utils/canvasEngine';
import { MetadataInspectorPanel } from './MetadataInspectorPanel';

interface ImageTrayProps {
  images: MergerImage[];
  selectedImageIds: string[];
  onToggleSelectImage: (id: string) => void;
  onSelectAllImages: () => void;
  onClearSelection: () => void;
  onBrowseFiles: () => void;
  onDropFiles: (files: FileList) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSortImages: (mode: 'name-asc' | 'reverse') => void;
  onRenameImage: (id: string, name: string) => void;
  onOpenCrop: (id: string) => void;
  onRotate90: (id: string) => void;
  onUpdateRotation: (id: string, rotation: number) => void;
  onToggleFlip: (id: string, axis: 'flipH' | 'flipV') => void;
  onUpdateFilters: (id: string, filters: ImageFilters) => void;
  onMoveEdge: (id: string, edge: 'first' | 'last') => void;
  onDelete: (id: string) => void;
}

const ImageThumbnail: React.FC<{
  image: MergerImage;
  cssFilter: string;
  rotationDeg: number;
}> = ({ image, cssFilter, rotationDeg }) => {
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = thumbCanvasRef.current;
    if (!canvas || !image.crop || !image.img) return;
    const sx = clamp(image.crop.x, 0, Math.max(0, image.width - 1));
    const sy = clamp(image.crop.y, 0, Math.max(0, image.height - 1));
    const sw = clamp(image.crop.width, 1, Math.max(1, image.width - sx));
    const sh = clamp(image.crop.height, 1, Math.max(1, image.height - sy));

    const maxDim = 320;
    const scale = Math.min(maxDim / sw, maxDim / sh, 1);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(image.img, sx, sy, sw, sh, 0, 0, dw, dh);
  }, [image.img, image.crop, image.width, image.height]);

  const isTilted = rotationDeg % 90 !== 0;
  const rotFitScale = isTilted ? 0.74 : 1;
  const style: React.CSSProperties = {
    filter: cssFilter,
    transform: `rotate(${rotationDeg}deg) scale(${(image.flipH ? -1 : 1) * rotFitScale}, ${(image.flipV ? -1 : 1) * rotFitScale})`,
  };

  if (image.crop) {
    return (
      <canvas
        ref={thumbCanvasRef}
        aria-label={`${image.name} cropped preview`}
        style={style}
        className="h-full w-full object-contain transition-transform duration-150"
      />
    );
  }

  return (
    <img
      src={image.src}
      alt={image.name}
      style={style}
      className="h-full w-full object-contain transition-transform duration-150"
    />
  );
};

export const ImageTray: React.FC<ImageTrayProps> = ({
  images,
  selectedImageIds,
  onToggleSelectImage,
  onSelectAllImages,
  onClearSelection,
  onBrowseFiles,
  onDropFiles,
  onReorder,
  onSortImages,
  onRenameImage,
  onOpenCrop,
  onRotate90,
  onUpdateRotation,
  onToggleFlip,
  onUpdateFilters,
  onMoveEdge,
  onDelete,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [expandedFxId, setExpandedFxId] = useState<string | null>(null);
  const [expandedMetaId, setExpandedMetaId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');

  const selectedSet = React.useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const allSelected = images.length > 0 && selectedSet.size === images.length;

  const commitInlineRename = (id: string) => {
    const trimmed = editingDraft.trim();
    if (trimmed) {
      onRenameImage(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <section
      id="source-tray"
      aria-label="Source images tray"
      className="rounded-card border border-border bg-surface p-4 shadow-surface"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            Source Images ({images.length}/{MAX_IMAGES})
            {selectedSet.size > 0 && (
              <span className="ml-2 font-mono text-xs font-medium text-primary">
                · {selectedSet.size} selected
              </span>
            )}
          </h2>
          <p className="text-xs text-muted">
            Select cards for batch color edits, drag to reorder, double-click name to rename, or inspect EXIF & metadata.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {images.length > 0 && (
            <>
              <button
                type="button"
                data-testid="tray-select-all-btn"
                onClick={allSelected ? onClearSelection : onSelectAllImages}
                title={allSelected ? 'Clear tray selection' : 'Select all images in tray'}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
              >
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>{allSelected ? 'Clear Selection' : 'Select All'}</span>
              </button>
              {selectedSet.size > 0 && !allSelected && (
                <button
                  type="button"
                  data-testid="tray-clear-selection-btn"
                  onClick={onClearSelection}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground whitespace-nowrap shrink-0"
                >
                  Deselect
                </button>
              )}
            </>
          )}

          {images.length >= 2 && (
            <>
              <button
                type="button"
                onClick={() => onSortImages('name-asc')}
                title="Sort source images alphabetically by name"
                className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
              >
                <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sort A–Z</span>
              </button>
              <button
                type="button"
                onClick={() => onSortImages('reverse')}
                title="Reverse image sequence"
                className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent-soft/60 whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reverse</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onBrowseFiles}
            onDragOver={(e) => {
              e.preventDefault();
              setDropzoneActive(true);
            }}
            onDragLeave={() => setDropzoneActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropzoneActive(false);
              if (e.dataTransfer.files?.length) {
                onDropFiles(e.dataTransfer.files);
              }
            }}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              dropzoneActive
                ? 'border-primary bg-accent-soft text-primary'
                : 'border-border bg-well text-foreground hover:bg-accent-soft/60'
            }`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Images</span>
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDropzoneActive(true);
          }}
          onDragLeave={() => setDropzoneActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropzoneActive(false);
            if (e.dataTransfer.files?.length) {
              onDropFiles(e.dataTransfer.files);
            }
          }}
          className={`rounded-control border border-dashed px-4 py-6 text-center text-xs transition-colors ${
            dropzoneActive
              ? 'border-primary bg-accent-soft/50 text-primary'
              : 'border-border text-muted'
          }`}
        >
          No images loaded yet. Use the upload button, paste from clipboard, or pick a sample template above.
        </div>
      ) : (
        <div
          role="list"
          aria-label="Uploaded source images"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        >
          {images.map((image, index) => {
            const isFxOpen = expandedFxId === image.id;
            const isMetaOpen = expandedMetaId === image.id;
            const isSelected = selectedSet.has(image.id);
            const cssFilter = buildCssFilterString(image.filters);
            const normalizedRot = normalizeDegrees(image.rotation);
            const sharpenVal = image.filters.sharpen ?? 0;
            const hueVal = image.filters.hue ?? 0;
            const hasFx =
              cssFilter !== 'none' ||
              sharpenVal > 0 ||
              hueVal !== 0 ||
              image.flipH ||
              image.flipV ||
              normalizedRot !== 0;
            const effDims = getEffectiveImageDimensions(image);

            return (
              <div
                key={image.id}
                role="listitem"
                draggable
                onDragStart={() => setDraggedIdx(index)}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedIdx !== null && draggedIdx !== index) {
                    setDragOverIdx(index);
                  }
                }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIdx !== null && draggedIdx !== index) {
                    onReorder(draggedIdx, index);
                  }
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className={`flex flex-col overflow-hidden rounded-card border bg-well/40 transition-all ${
                  dragOverIdx === index
                    ? 'border-primary ring-2 ring-primary/30'
                    : draggedIdx === index
                      ? 'border-border opacity-60'
                      : isSelected
                        ? 'border-primary ring-1 ring-primary/40'
                        : 'border-border'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative h-28 w-full overflow-hidden bg-well p-1.5">
                  <ImageThumbnail
                    image={image}
                    cssFilter={cssFilter}
                    rotationDeg={normalizedRot}
                  />
                  <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white tabular-nums">
                    #{index + 1}
                  </span>
                  <label
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-black/65 text-white hover:bg-black/80'
                    }`}
                    title={isSelected ? 'Selected for batch color edits' : 'Select for batch color edits'}
                  >
                    <input
                      id={`tray-select-image-${image.id}`}
                      name={`traySelectImage_${image.id}`}
                      type="checkbox"
                      data-testid={`tray-select-checkbox-${index}`}
                      aria-label={`Select ${image.name} for batch edits`}
                      checked={isSelected}
                      onChange={() => onToggleSelectImage(image.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                  </label>
                </div>

                {/* Unboxed Info & Inline Filename Rename */}
                <div className="px-3 py-2.5">
                  {editingId === image.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitInlineRename(image.id);
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        id={`inline-rename-${image.id}`}
                        name={`inlineRename_${image.id}`}
                        type="text"
                        autoFocus
                        aria-label={`Rename ${image.name}`}
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => commitInlineRename(image.id)}
                        className="min-w-0 flex-1 rounded border border-primary bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Confirm filename"
                        className="cursor-pointer rounded p-0.5 text-primary hover:bg-accent-soft"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <div className="group flex items-center justify-between gap-1.5">
                      <span
                        title={`${image.name} (double-click to rename)`}
                        onDoubleClick={() => {
                          setEditingId(image.id);
                          setEditingDraft(image.name);
                        }}
                        className="truncate text-xs font-semibold text-foreground"
                      >
                        {image.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(image.id);
                          setEditingDraft(image.name);
                        }}
                        aria-label={`Rename ${image.name}`}
                        title="Rename file"
                        className="shrink-0 cursor-pointer rounded p-0.5 text-muted opacity-70 transition-opacity hover:bg-well hover:text-primary hover:opacity-100"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted tabular-nums">
                    <span>{formatBytes(image.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {effDims.width}×{effDims.height}
                      {image.crop ? ' · cropped' : ''}
                      {normalizedRot !== 0 ? ` · ${normalizedRot}°` : ''}
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border bg-surface px-2 py-1.5">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onOpenCrop(image.id)}
                      aria-label={`Crop ${image.name}`}
                      aria-pressed={Boolean(image.crop)}
                      title="Crop & focal area"
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                        image.crop
                          ? 'bg-accent-soft text-primary'
                          : 'text-muted hover:bg-well hover:text-foreground'
                      }`}
                    >
                      <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRotate90(image.id)}
                      aria-label={`Rotate ${image.name} 90 degrees`}
                      title="Rotate 90° clockwise"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-well hover:text-foreground"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFlip(image.id, 'flipH')}
                      aria-label={`Flip ${image.name} horizontally`}
                      aria-pressed={image.flipH}
                      title="Flip horizontal"
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                        image.flipH
                          ? 'bg-accent-soft text-primary'
                          : 'text-muted hover:bg-well hover:text-foreground'
                      }`}
                    >
                      <FlipHorizontal2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFlip(image.id, 'flipV')}
                      aria-label={`Flip ${image.name} vertically`}
                      aria-pressed={image.flipV}
                      title="Flip vertical"
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                        image.flipV
                          ? 'bg-accent-soft text-primary'
                          : 'text-muted hover:bg-well hover:text-foreground'
                      }`}
                    >
                      <FlipVertical2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExpandedFxId(isFxOpen ? null : image.id);
                        if (!isFxOpen) setExpandedMetaId(null);
                      }}
                      aria-expanded={isFxOpen}
                      aria-label={`Adjust angle and filters for ${image.name}`}
                      title="Free rotation (0–360°) & color filters"
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                        isFxOpen || hasFx
                          ? 'bg-accent-soft text-primary'
                          : 'text-muted hover:bg-well hover:text-foreground'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      data-testid={`tray-metadata-btn-${index}`}
                      onClick={() => {
                        setExpandedMetaId(isMetaOpen ? null : image.id);
                        if (!isMetaOpen) setExpandedFxId(null);
                      }}
                      aria-expanded={isMetaOpen}
                      aria-label={`Inspect metadata for ${image.name}`}
                      title="Read-only EXIF, original resolution & color profile"
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                        isMetaOpen
                          ? 'bg-accent-soft text-primary'
                          : 'text-muted hover:bg-well hover:text-foreground'
                      }`}
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onMoveEdge(image.id, 'first')}
                      disabled={index === 0}
                      aria-label={`Move ${image.name} to first`}
                      title="Move to first"
                      className="inline-flex h-8 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-well hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onMoveEdge(image.id, 'last')}
                      disabled={index === images.length - 1}
                      aria-label={`Move ${image.name} to last`}
                      title="Move to last"
                      className="inline-flex h-8 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-well hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(image.id)}
                      aria-label={`Delete ${image.name}`}
                      title="Delete image"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Inline Free-Rotation & Filter Adjustment Drawer */}
                {isFxOpen && (
                  <div className="space-y-2.5 border-t border-border bg-surface px-3 py-2.5 text-xs">
                    {/* Free Rotation 0 - 360° */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">Free Rotation</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-foreground tabular-nums">
                            {normalizedRot}°
                          </span>
                          {normalizedRot !== 0 && (
                            <button
                              type="button"
                              onClick={() => onUpdateRotation(image.id, 0)}
                              className="cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline"
                            >
                              0°
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        id={`tray-rotation-${image.id}`}
                        name={`trayRotation_${image.id}`}
                        type="range"
                        aria-label={`Free rotation angle for ${image.name}`}
                        min={0}
                        max={360}
                        step={1}
                        value={normalizedRot}
                        onChange={(e) => onUpdateRotation(image.id, Number(e.target.value))}
                        className="studio-range w-full"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between">
                        <label htmlFor={`tray-brightness-${image.id}`} className="text-muted">Brightness</label>
                        <span className="font-mono tabular-nums text-foreground">
                          {image.filters.brightness}%
                        </span>
                      </div>
                      <input
                        id={`tray-brightness-${image.id}`}
                        name={`trayBrightness_${image.id}`}
                        type="range"
                        aria-label={`Brightness for ${image.name}`}
                        min={50}
                        max={150}
                        value={image.filters.brightness}
                        onChange={(e) =>
                          onUpdateFilters(image.id, {
                            ...image.filters,
                            brightness: Number(e.target.value),
                          })
                        }
                        className="studio-range w-full"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between">
                        <label htmlFor={`tray-contrast-${image.id}`} className="text-muted">Contrast</label>
                        <span className="font-mono tabular-nums text-foreground">
                          {image.filters.contrast}%
                        </span>
                      </div>
                      <input
                        id={`tray-contrast-${image.id}`}
                        name={`trayContrast_${image.id}`}
                        type="range"
                        aria-label={`Contrast for ${image.name}`}
                        min={50}
                        max={150}
                        value={image.filters.contrast}
                        onChange={(e) =>
                          onUpdateFilters(image.id, {
                            ...image.filters,
                            contrast: Number(e.target.value),
                          })
                        }
                        className="studio-range w-full"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between">
                        <label htmlFor={`tray-saturation-${image.id}`} className="text-muted">Saturation</label>
                        <span className="font-mono tabular-nums text-foreground">
                          {image.filters.saturation}%
                        </span>
                      </div>
                      <input
                        id={`tray-saturation-${image.id}`}
                        name={`traySaturation_${image.id}`}
                        type="range"
                        aria-label={`Saturation for ${image.name}`}
                        min={0}
                        max={200}
                        value={image.filters.saturation}
                        onChange={(e) =>
                          onUpdateFilters(image.id, {
                            ...image.filters,
                            saturation: Number(e.target.value),
                          })
                        }
                        className="studio-range w-full"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between">
                        <label htmlFor={`tray-hue-${image.id}`} className="text-muted">Hue</label>
                        <span className="font-mono tabular-nums text-foreground">
                          {hueVal > 0 ? `+${hueVal}` : hueVal}°
                        </span>
                      </div>
                      <input
                        id={`tray-hue-${image.id}`}
                        name={`trayHue_${image.id}`}
                        type="range"
                        aria-label={`Hue for ${image.name}`}
                        min={-180}
                        max={180}
                        value={hueVal}
                        onChange={(e) =>
                          onUpdateFilters(image.id, {
                            ...image.filters,
                            hue: Number(e.target.value),
                          })
                        }
                        className="studio-range w-full"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between">
                        <label htmlFor={`tray-sharpen-${image.id}`} className="text-muted">Sharpen</label>
                        <span className="font-mono tabular-nums text-foreground">
                          {sharpenVal}%
                        </span>
                      </div>
                      <input
                        id={`tray-sharpen-${image.id}`}
                        name={`traySharpen_${image.id}`}
                        type="range"
                        aria-label={`Sharpen for ${image.name}`}
                        min={0}
                        max={100}
                        value={sharpenVal}
                        onChange={(e) =>
                          onUpdateFilters(image.id, {
                            ...image.filters,
                            sharpen: Number(e.target.value),
                          })
                        }
                        className="studio-range w-full"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <label htmlFor={`tray-grayscale-${image.id}`} className="flex cursor-pointer items-center gap-1.5 text-foreground">
                        <input
                          id={`tray-grayscale-${image.id}`}
                          name={`trayGrayscale_${image.id}`}
                          type="checkbox"
                          checked={image.filters.grayscale}
                          onChange={(e) =>
                            onUpdateFilters(image.id, {
                              ...image.filters,
                              grayscale: e.target.checked,
                            })
                          }
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span>Grayscale</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateFilters(image.id, { ...DEFAULT_FILTERS });
                          onUpdateRotation(image.id, 0);
                        }}
                        className="cursor-pointer text-xs font-medium text-primary hover:underline"
                      >
                        Reset FX
                      </button>
                    </div>
                  </div>
                )}

                {/* Read-only Metadata Inspector Panel (EXIF, original resolution, color profile) */}
                {isMetaOpen && <MetadataInspectorPanel image={image} index={index} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
