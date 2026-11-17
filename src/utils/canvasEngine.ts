import type {
  BatchRenameOptions,
  BatchResizeMode,
  BatchWatermarkOptions,
  ContentAnalysisSignal,
  CropAspectPreset,
  CropRect,
  ExportDimensionsConfig,
  ImageFilters,
  LayoutMode,
  MergerImage,
  MergerSettings,
  OutputFormat,
  SmartAlignmentMode,
  TextStampPosition,
  TextStampSettings,
} from '../types/merger';

export const MAX_IMAGES = 50;
export const MAX_CANVAS_SIZE = 8000;
export const MIN_CANVAS_SIZE = 1;
export const MIN_OVERLAY_WIDTH = 800;
export const MIN_OVERLAY_HEIGHT = 600;

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: false,
  sharpen: 0,
};

export const DEFAULT_TEXT_STAMP: TextStampSettings = {
  enabled: false,
  text: 'Image Merger Pro',
  fontSize: 28,
  color: '#0f172a',
  opacity: 85,
  position: 'bottom-right',
  padding: 24,
  shadow: true,
};

export const DEFAULT_SETTINGS: MergerSettings = {
  layout: 'horizontal',
  spacing: 16,
  padding: 0,
  alignment: 'center',
  columns: 2,
  autoColumns: true,
  scaleMode: 'same-height',
  customScale: 100,
  bgColor: '#ffffff',
  transparentBg: false,
  borderWidth: 0,
  borderColor: '#0f172a',
  cornerRadius: 0,
  shadowBlur: 0,
  format: 'png',
  quality: 92,
  filenamePrefix: 'merged',
  textStamp: { ...DEFAULT_TEXT_STAMP },
};

export interface ImageDimensionInput {
  id: string;
  width: number;
  height: number;
  crop?: Pick<CropRect, 'x' | 'y' | 'width' | 'height'>;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}

export const CROP_ASPECT_RATIOS: Record<CropAspectPreset, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '3:4': 3 / 4,
  'id-card': 85.6 / 54,
};

export function getEffectiveImageDimensions(
  img: Pick<ImageDimensionInput, 'width' | 'height' | 'crop'>,
): { width: number; height: number } {
  if (img.crop && img.crop.width > 0 && img.crop.height > 0) {
    return {
      width: Math.max(1, Math.round(img.crop.width)),
      height: Math.max(1, Math.round(img.crop.height)),
    };
  }
  return {
    width: Math.max(1, Math.round(img.width || 1)),
    height: Math.max(1, Math.round(img.height || 1)),
  };
}

/**
 * Computes a bounded crop rectangle around a normalized focal point (0..1, 0..1)
 * matching the requested aspectRatio (or full frame if null).
 */
export function computeAspectCropRect(
  imgWidth: number,
  imgHeight: number,
  aspectRatio: number | null,
  focalNormX = 0.5,
  focalNormY = 0.5,
  preset: CropAspectPreset = 'free',
): CropRect {
  const w = Math.max(1, Math.round(imgWidth));
  const h = Math.max(1, Math.round(imgHeight));
  const fx = clamp(focalNormX, 0, 1);
  const fy = clamp(focalNormY, 0, 1);

  if (!aspectRatio || aspectRatio <= 0) {
    return { x: 0, y: 0, width: w, height: h, aspectPreset: preset, focalX: fx, focalY: fy };
  }

  let cropW = w;
  let cropH = Math.round(w / aspectRatio);
  if (cropH > h) {
    cropH = h;
    cropW = Math.round(h * aspectRatio);
  }

  cropW = clamp(cropW, 1, w);
  cropH = clamp(cropH, 1, h);

  const centerX = fx * w;
  const centerY = fy * h;
  const x = Math.round(clamp(centerX - cropW / 2, 0, w - cropW));
  const y = Math.round(clamp(centerY - cropH / 2, 0, h - cropH));

  return {
    x,
    y,
    width: cropW,
    height: cropH,
    aspectPreset: preset,
    focalX: fx,
    focalY: fy,
  };
}

/**
 * Pure batch resize target calculation preserving aspect ratio cleanly.
 */
export function computeBatchResizeDimensions(
  origWidth: number,
  origHeight: number,
  mode: BatchResizeMode,
  value: number,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(origWidth));
  const h = Math.max(1, Math.round(origHeight));
  const v = Math.max(1, value);

  switch (mode) {
    case 'max-edge': {
      const longest = Math.max(w, h);
      if (longest <= v) return { width: w, height: h };
      const ratio = v / longest;
      return {
        width: Math.max(1, Math.round(w * ratio)),
        height: Math.max(1, Math.round(h * ratio)),
      };
    }
    case 'width': {
      const ratio = v / w;
      return {
        width: Math.max(1, Math.round(v)),
        height: Math.max(1, Math.round(h * ratio)),
      };
    }
    case 'height': {
      const ratio = v / h;
      return {
        width: Math.max(1, Math.round(w * ratio)),
        height: Math.max(1, Math.round(v)),
      };
    }
    case 'percent': {
      const s = clamp(v, 5, 400) / 100;
      return {
        width: Math.max(1, Math.round(w * s)),
        height: Math.max(1, Math.round(h * s)),
      };
    }
  }
}

export interface PositionedDrawRect {
  id: string;
  index: number;
  cx: number; // center x in unscaled canvas space
  cy: number; // center y in unscaled canvas space
  w: number;
  h: number;
  rotationDeg: number;
  opacity: number;
}

export interface CanvasLayoutResult {
  rawWidth: number;
  rawHeight: number;
  width: number;
  height: number;
  scaleFactor: number;
  wasCapped: boolean;
  items: PositionedDrawRect[];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDegrees(deg = 0): number {
  if (!Number.isFinite(deg)) return 0;
  const mod = ((deg % 360) + 360) % 360;
  return Math.round(mod * 10) / 10;
}

export function computeFitZoomScale(
  canvasWidth: number,
  canvasHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 48,
): number {
  if (canvasWidth <= 0 || canvasHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return 1;
  }
  const availW = Math.max(80, viewportWidth - paddingPx);
  const availH = Math.max(80, viewportHeight - paddingPx);
  const ratio = Math.min(availW / canvasWidth, availH / canvasHeight, 1);
  return Math.max(0.05, Number(ratio.toFixed(3)));
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>&"'\x00-\x1f]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'merged';
}

export interface AutoArrangeResult {
  settingsPatch: Partial<MergerSettings>;
  imagePatches: Array<{
    id: string;
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
  }>;
  summary: string;
}

/**
 * Analyzes loaded images and computes optimal spacing, outer padding, column count,
 * scaling mode (or overlay positions & scales) for the active layout.
 */
export function computeAutoArrange(
  images: ImageDimensionInput[],
  settings: Pick<
    MergerSettings,
    | 'layout'
    | 'spacing'
    | 'padding'
    | 'alignment'
    | 'columns'
    | 'autoColumns'
    | 'scaleMode'
    | 'customScale'
    | 'borderWidth'
  >,
): AutoArrangeResult {
  if (images.length === 0) {
    return {
      settingsPatch: {},
      imagePatches: [],
      summary: 'Load images to auto-arrange.',
    };
  }

  const effDims = images.map((im) => ({
    id: im.id,
    ...getEffectiveImageDimensions(im),
    opacity: im.opacity ?? 100,
  }));

  const widths = effDims.map((d) => d.width);
  const heights = effDims.map((d) => d.height);
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);

  const snap4 = (val: number, minVal: number, maxVal: number) =>
    clamp(Math.round(val / 4) * 4, minVal, maxVal);

  if (settings.layout === 'horizontal') {
    const heightVariance = maxH - minH;
    let scaleMode: MergerSettings['scaleMode'] =
      images.length === 1 || heightVariance <= 4 ? 'original' : 'same-height';
    let customScale = settings.customScale;

    // Estimate resulting total width under candidate scaleMode; guard against extreme canvas overflow
    const testLayout = calcCanvasLayout(images, {
      ...settings,
      layout: 'horizontal',
      scaleMode,
      spacing: 16,
      padding: 16,
    });

    if (testLayout.rawWidth > MAX_CANVAS_SIZE) {
      const safePct = clamp(Math.floor((MAX_CANVAS_SIZE / testLayout.rawWidth) * 95), 15, 100);
      scaleMode = 'custom';
      customScale = safePct;
    }

    const baseHeight = scaleMode === 'same-height' ? minH : maxH;
    const spacing = images.length === 1 ? 0 : snap4(baseHeight * 0.025, 8, 36);
    const padding = snap4(baseHeight * 0.03, 12, 36);

    return {
      settingsPatch: {
        scaleMode,
        customScale,
        spacing,
        padding,
        alignment: 'center',
      },
      imagePatches: [],
      summary: `Horizontal · ${scaleMode === 'same-height' ? 'Same height' : scaleMode === 'custom' ? `${customScale}% scale` : 'Original'} · ${spacing}px gap`,
    };
  }

  if (settings.layout === 'vertical') {
    const widthVariance = maxW - minW;
    let scaleMode: MergerSettings['scaleMode'] =
      images.length === 1 || widthVariance <= 4 ? 'original' : 'same-width';
    let customScale = settings.customScale;

    const testLayout = calcCanvasLayout(images, {
      ...settings,
      layout: 'vertical',
      scaleMode,
      spacing: 16,
      padding: 16,
    });

    if (testLayout.rawHeight > MAX_CANVAS_SIZE) {
      const safePct = clamp(Math.floor((MAX_CANVAS_SIZE / testLayout.rawHeight) * 95), 15, 100);
      scaleMode = 'custom';
      customScale = safePct;
    }

    const baseWidth = scaleMode === 'same-width' ? minW : maxW;
    const spacing = images.length === 1 ? 0 : snap4(baseWidth * 0.025, 8, 36);
    const padding = snap4(baseWidth * 0.03, 12, 36);

    return {
      settingsPatch: {
        scaleMode,
        customScale,
        spacing,
        padding,
        alignment: 'center',
      },
      imagePatches: [],
      summary: `Vertical · ${scaleMode === 'same-width' ? 'Same width' : scaleMode === 'custom' ? `${customScale}% scale` : 'Original'} · ${spacing}px gap`,
    };
  }

  if (settings.layout === 'grid') {
    const count = effDims.length;
    const scaleMode: MergerSettings['scaleMode'] = count === 1 ? 'original' : 'fit-smallest';
    const cellRef = Math.min(minW, minH);
    const spacing = count === 1 ? 0 : snap4(cellRef * 0.03, 12, 32);
    const padding = snap4(cellRef * 0.04, 16, 40);

    // Search candidate column counts to find the most balanced composite aspect ratio (~1.35)
    // and avoid awkward lone orphan cells when possible.
    let bestCols = Math.ceil(Math.sqrt(count));
    let bestScore = Infinity;
    const maxCols = Math.min(count, 6);

    for (let cols = 1; cols <= maxCols; cols++) {
      const candidate = calcCanvasLayout(images, {
        ...settings,
        layout: 'grid',
        autoColumns: false,
        columns: cols,
        scaleMode,
        spacing,
        padding,
      });
      const rows = Math.ceil(count / cols);
      const emptySlots = cols * rows - count;
      const ratio = candidate.width / Math.max(1, candidate.height);
      const ratioPenalty = Math.abs(Math.log(ratio / 1.35));
      const orphanPenalty = count > 2 && emptySlots === cols - 1 ? 0.45 : emptySlots * 0.12;
      const overflowPenalty = candidate.wasCapped ? 3 : 0;
      const score = ratioPenalty + orphanPenalty + overflowPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestCols = cols;
      }
    }

    return {
      settingsPatch: {
        autoColumns: false,
        columns: bestCols,
        scaleMode,
        spacing,
        padding,
      },
      imagePatches: [],
      summary: `Grid ${bestCols}×${Math.ceil(count / bestCols)} · Fit smallest · ${spacing}px gap`,
    };
  }

  // Overlay layout: normalize disparate layer sizes and fan layers cleanly across a balanced grid around (0, 0)
  const count = effDims.length;
  const cols = Math.min(count, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const targetCellW = clamp(Math.round(1100 / cols), 220, 560);
  const targetCellH = clamp(Math.round(760 / rows), 180, 440);
  const gap = 28;
  const totalSpanW = cols * targetCellW + (cols - 1) * gap;
  const totalSpanH = rows * targetCellH + (rows - 1) * gap;

  const imagePatches = effDims.map((d, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const fitPct = clamp(
      Math.round(Math.min(targetCellW / d.width, targetCellH / d.height) * 100),
      10,
      200,
    );
    const x = Math.round(-totalSpanW / 2 + targetCellW / 2 + col * (targetCellW + gap));
    const y = Math.round(-totalSpanH / 2 + targetCellH / 2 + row * (targetCellH + gap));
    return {
      id: d.id,
      x,
      y,
      scale: fitPct,
      rotation: 0,
      opacity: d.opacity <= 5 ? 100 : d.opacity,
    };
  });

  return {
    settingsPatch: { padding: 32 },
    imagePatches,
    summary: `Overlay · ${cols}×${rows} balanced spread across canvas`,
  };
}

function splitNameAndExtension(filename: string): { base: string; ext: string } {
  const trimmed = filename.trim() || 'image.png';
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { base: trimmed, ext: '' };
  }
  return {
    base: trimmed.slice(0, lastDot),
    ext: trimmed.slice(lastDot),
  };
}

function applyRenameCase(text: string, caseMode: BatchRenameOptions['caseMode']): string {
  switch (caseMode) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'kebab':
      return text
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    case 'snake':
      return text
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    default:
      return text;
  }
}

/**
 * Formats a single filename using pattern tokens ({name}, {n}, {nn}, {nnn}, {w}, {h}, {total})
 * with incrementing counter and automatic collision prevention.
 */
export function formatBatchRenamedFilename(
  originalName: string,
  index: number,
  totalCount: number,
  width: number,
  height: number,
  options: BatchRenameOptions,
): string {
  const { base: rawBase, ext } = splitNameAndExtension(originalName);
  const safeBase = rawBase.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'image';
  const counterNum = Math.max(0, Math.round(options.startNumber)) + index * Math.max(1, Math.round(options.step));
  const padWidth = clamp(Math.round(options.zeroPad), 1, 6);
  const paddedDefault = String(counterNum).padStart(padWidth, '0');

  let rawPattern = options.pattern.trim() || '{name}-{nn}';
  const hasCounterToken = /\{(n+|counter|index)\}/i.test(rawPattern);

  let rendered = rawPattern
    .replace(/\{name\}/gi, safeBase)
    .replace(/\{w\}/gi, String(Math.max(1, Math.round(width))))
    .replace(/\{h\}/gi, String(Math.max(1, Math.round(height))))
    .replace(/\{total\}/gi, String(Math.max(1, totalCount)))
    .replace(/\{counter\}/gi, paddedDefault)
    .replace(/\{index\}/gi, String(index + 1))
    .replace(/\{(n+)\}/gi, (_match, ns: string) => {
      const len = ns.length === 1 ? 1 : Math.max(ns.length, padWidth);
      return String(counterNum).padStart(len, '0');
    });

  if (!hasCounterToken && totalCount > 1) {
    rendered = `${rendered}-${paddedDefault}`;
  }

  const sanitizedStem = rendered
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const casedStem = applyRenameCase(sanitizedStem || `image-${paddedDefault}`, options.caseMode);
  const finalExt = options.preserveExtension ? (ext ? ext.toLowerCase() : '.png') : '';
  return `${casedStem || `image-${paddedDefault}`}${finalExt}`;
}

export function generateBatchRenamedNames(
  images: Array<Pick<ImageDimensionInput, 'id' | 'width' | 'height' | 'crop'> & { name: string }>,
  options: BatchRenameOptions,
): Array<{ id: string; oldName: string; newName: string }> {
  const seen = new Map<string, number>();
  return images.map((im, idx) => {
    const eff = getEffectiveImageDimensions(im);
    let candidate = formatBatchRenamedFilename(
      im.name,
      idx,
      images.length,
      eff.width,
      eff.height,
      options,
    );
    const key = candidate.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count > 0) {
      const { base, ext } = splitNameAndExtension(candidate);
      candidate = `${base}-${count + 1}${ext}`;
    }
    return {
      id: im.id,
      oldName: im.name,
      newName: candidate,
    };
  });
}

// IEEE CRC-32 table for pure zero-dependency ZIP archive creation
const CRC32_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Pure zero-dependency PKZIP archive builder (STORE method, CRC-32 verified).
 * Allows exporting all batch-processed & renamed images in a single .zip file.
 */
export function buildZipArchive(
  entries: Array<{ name: string; data: Uint8Array }>,
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = new ArrayBuffer(30);
    const lv = new DataView(localHeader);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // Compression: STORE
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0x5421, true); // Mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);

    const centralHeader = new ArrayBuffer(46);
    const cv = new DataView(centralHeader);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);

    localParts.push(new Uint8Array(localHeader), nameBytes, entry.data);
    centralParts.push(new Uint8Array(centralHeader), nameBytes);
    offset += 30 + nameBytes.length + size;
  }

  let centralSize = 0;
  for (const part of centralParts) {
    centralSize += part.length;
  }

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true); // End of central directory
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalBytes = offset + centralSize + 22;
  const result = new Uint8Array(new ArrayBuffer(totalBytes));
  let pos = 0;
  for (const p of localParts) {
    result.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    result.set(p, pos);
    pos += p.length;
  }
  result.set(new Uint8Array(eocd), pos);
  return result;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—';
  const divisor = gcd(width, height);
  const rw = Math.round(width / divisor);
  const rh = Math.round(height / divisor);
  if (rw > 40 || rh > 40) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${rw}:${rh}`;
}

export function calcPrintSizeInches(widthPx: number, heightPx: number, dpi = 300): string {
  if (widthPx <= 0 || heightPx <= 0 || dpi <= 0) return '0 × 0 in';
  const wIn = (widthPx / dpi).toFixed(1);
  const hIn = (heightPx / dpi).toFixed(1);
  return `${wIn} × ${hIn} in`;
}

export function buildCssFilterString(filters?: Partial<ImageFilters>): string {
  if (!filters) return 'none';
  const b = filters.brightness ?? 100;
  const c = filters.contrast ?? 100;
  const s = filters.saturation ?? 100;
  const h = filters.hue ?? 0;
  const g = filters.grayscale ? 100 : 0;
  if (b === 100 && c === 100 && s === 100 && h === 0 && g === 0) {
    return 'none';
  }
  const parts = [`brightness(${b}%)`, `contrast(${c}%)`, `saturate(${s}%)`];
  if (h !== 0) {
    parts.push(`hue-rotate(${h}deg)`);
  }
  parts.push(`grayscale(${g}%)`);
  return parts.join(' ');
}

/**
 * Pure helper applying a partial color/filter patch to selected tray image IDs
 * (or all images when selectedIds is empty).
 */
export function applyBatchColorAdjustments<T extends { id: string; filters: ImageFilters }>(
  images: T[],
  selectedIds: string[],
  patch: Partial<ImageFilters>,
): T[] {
  const targetSet = selectedIds.length > 0 ? new Set(selectedIds) : null;
  return images.map((im) => {
    if (targetSet && !targetSet.has(im.id)) return im;
    return {
      ...im,
      filters: {
        ...DEFAULT_FILTERS,
        ...im.filters,
        ...patch,
      },
    };
  });
}

/**
 * Pure deterministic layout calculation for Horizontal, Vertical, Grid, and Overlay modes.
 * Runs cleanly in Node (unit tests) as well as Browser.
 */
export function calcCanvasLayout(
  images: ImageDimensionInput[],
  settings: Pick<
    MergerSettings,
    | 'layout'
    | 'spacing'
    | 'padding'
    | 'alignment'
    | 'columns'
    | 'autoColumns'
    | 'scaleMode'
    | 'customScale'
    | 'borderWidth'
  >,
): CanvasLayoutResult {
  if (images.length === 0) {
    return {
      rawWidth: 0,
      rawHeight: 0,
      width: 0,
      height: 0,
      scaleFactor: 1,
      wasCapped: false,
      items: [],
    };
  }

  const {
    layout,
    spacing,
    padding,
    alignment,
    columns,
    autoColumns,
    scaleMode,
    customScale,
    borderWidth,
  } = settings;

  const borderOffset = borderWidth * 2;
  const outerPad = Math.max(0, padding);

  if (layout === 'overlay') {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const rawItems: PositionedDrawRect[] = images.map((img, index) => {
      const eff = getEffectiveImageDimensions(img);
      const baseW = eff.width;
      const baseH = eff.height;
      const layerScale = (img.scale ?? 100) / 100;
      const w = Math.max(1, baseW * layerScale);
      const h = Math.max(1, baseH * layerScale);
      const rot = img.rotation ?? 0;
      const angle = (rot * Math.PI) / 180;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));

      const halfW = cos * (w / 2) + sin * (h / 2) + borderWidth;
      const halfH = sin * (w / 2) + cos * (h / 2) + borderWidth;

      const cx = img.x ?? 0;
      const cy = img.y ?? 0;

      minX = Math.min(minX, cx - halfW);
      minY = Math.min(minY, cy - halfH);
      maxX = Math.max(maxX, cx + halfW);
      maxY = Math.max(maxY, cy + halfH);

      return {
        id: img.id,
        index,
        cx,
        cy,
        w,
        h,
        rotationDeg: rot,
        opacity: clamp(img.opacity ?? 100, 0, 100) / 100,
      };
    });

    if (!Number.isFinite(minX)) {
      minX = -100;
      minY = -100;
      maxX = 100;
      maxY = 100;
    }

    const maxAbsX = Math.max(Math.abs(minX), Math.abs(maxX));
    const maxAbsY = Math.max(Math.abs(minY), Math.abs(maxY));

    const contentWidth = 2 * maxAbsX + outerPad * 2;
    const contentHeight = 2 * maxAbsY + outerPad * 2;

    const rawWidth = Math.max(MIN_OVERLAY_WIDTH, Math.ceil(contentWidth));
    const rawHeight = Math.max(MIN_OVERLAY_HEIGHT, Math.ceil(contentHeight));

    const centerOffsetX = rawWidth / 2;
    const centerOffsetY = rawHeight / 2;

    const positioned = rawItems.map((item) => ({
      ...item,
      cx: item.cx + centerOffsetX,
      cy: item.cy + centerOffsetY,
    }));

    return finalizeLayoutScale(rawWidth, rawHeight, positioned);
  }

  // Compute scaled sizes for Horizontal, Vertical, Grid using effective cropped dimensions
  const effectiveList = images.map((i) => ({
    ...i,
    eff: getEffectiveImageDimensions(i),
  }));
  const validImages = effectiveList.filter((i) => i.eff.width > 0 && i.eff.height > 0);
  let targetWidth = 0;
  let targetHeight = 0;

  if (validImages.length > 0 && scaleMode !== 'original' && scaleMode !== 'custom') {
    const widths = validImages.map((i) => i.eff.width);
    const heights = validImages.map((i) => i.eff.height);
    switch (scaleMode) {
      case 'fit-smallest':
        targetWidth = Math.min(...widths);
        targetHeight = Math.min(...heights);
        break;
      case 'fit-largest':
        targetWidth = Math.max(...widths);
        targetHeight = Math.max(...heights);
        break;
      case 'same-height':
        targetHeight = Math.min(...heights);
        break;
      case 'same-width':
        targetWidth = Math.min(...widths);
        break;
    }
  }

  const scaled = effectiveList.map((img, index) => {
    let w = img.eff.width;
    let h = img.eff.height;
    if (validImages.length > 0 && scaleMode !== 'original') {
      switch (scaleMode) {
        case 'fit-smallest':
        case 'fit-largest': {
          const sx = targetWidth / w || 1;
          const sy = targetHeight / h || 1;
          const s = Math.min(sx, sy);
          w = Math.floor(w * s);
          h = Math.floor(h * s);
          break;
        }
        case 'same-height': {
          const s = targetHeight / h || 1;
          w = Math.floor(w * s);
          h = targetHeight;
          break;
        }
        case 'same-width': {
          const s = targetWidth / w || 1;
          h = Math.floor(h * s);
          w = targetWidth;
          break;
        }
        case 'custom': {
          const s = (customScale || 100) / 100;
          w = Math.floor(w * s);
          h = Math.floor(h * s);
          break;
        }
      }
    }
    const rot = normalizeDegrees(img.rotation ?? 0);
    const rad = (rot * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const wBox = w + borderOffset;
    const hBox = h + borderOffset;
    const bboxW = rot === 0 ? wBox : Math.ceil(wBox * cos + hBox * sin);
    const bboxH = rot === 0 ? hBox : Math.ceil(wBox * sin + hBox * cos);

    return {
      id: img.id,
      index,
      w: Math.max(1, w),
      h: Math.max(1, h),
      bboxW: Math.max(1, bboxW),
      bboxH: Math.max(1, bboxH),
      rot,
    };
  });

  const boxWidths = scaled.map((s) => s.bboxW);
  const boxHeights = scaled.map((s) => s.bboxH);
  const items: PositionedDrawRect[] = [];

  let contentW = 0;
  let contentH = 0;

  if (layout === 'horizontal') {
    contentW =
      boxWidths.reduce((sum, bw) => sum + bw, 0) +
      spacing * Math.max(0, scaled.length - 1);
    contentH = Math.max(...boxHeights);

    let cursorX = outerPad;
    scaled.forEach((s, idx) => {
      let topY = outerPad;
      if (alignment === 'center') {
        topY = outerPad + (contentH - s.bboxH) / 2;
      } else if (alignment === 'end') {
        topY = outerPad + (contentH - s.bboxH);
      }

      items.push({
        id: s.id,
        index: idx,
        cx: cursorX + s.bboxW / 2,
        cy: topY + s.bboxH / 2,
        w: s.w,
        h: s.h,
        rotationDeg: s.rot,
        opacity: 1,
      });

      cursorX += s.bboxW + spacing;
    });
  } else if (layout === 'vertical') {
    contentW = Math.max(...boxWidths);
    contentH =
      boxHeights.reduce((sum, bh) => sum + bh, 0) +
      spacing * Math.max(0, scaled.length - 1);

    let cursorY = outerPad;
    scaled.forEach((s, idx) => {
      let leftX = outerPad;
      if (alignment === 'center') {
        leftX = outerPad + (contentW - s.bboxW) / 2;
      } else if (alignment === 'end') {
        leftX = outerPad + (contentW - s.bboxW);
      }

      items.push({
        id: s.id,
        index: idx,
        cx: leftX + s.bboxW / 2,
        cy: cursorY + s.bboxH / 2,
        w: s.w,
        h: s.h,
        rotationDeg: s.rot,
        opacity: 1,
      });

      cursorY += s.bboxH + spacing;
    });
  } else if (layout === 'grid') {
    const count = scaled.length;
    const cols = autoColumns ? Math.ceil(Math.sqrt(count)) : Math.max(1, columns);
    const rows = Math.ceil(count / cols);
    const cellW = Math.max(...boxWidths);
    const cellH = Math.max(...boxHeights);

    contentW = cols * cellW + Math.max(0, cols - 1) * spacing;
    contentH = rows * cellH + Math.max(0, rows - 1) * spacing;

    scaled.forEach((s, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cellX = outerPad + col * (cellW + spacing);
      const cellY = outerPad + row * (cellH + spacing);

      items.push({
        id: s.id,
        index: idx,
        cx: cellX + cellW / 2,
        cy: cellY + cellH / 2,
        w: s.w,
        h: s.h,
        rotationDeg: s.rot,
        opacity: 1,
      });
    });
  }

  const rawWidth = Math.max(MIN_CANVAS_SIZE, Math.ceil(contentW + outerPad * 2));
  const rawHeight = Math.max(MIN_CANVAS_SIZE, Math.ceil(contentH + outerPad * 2));

  return finalizeLayoutScale(rawWidth, rawHeight, items);
}

function finalizeLayoutScale(
  rawWidth: number,
  rawHeight: number,
  items: PositionedDrawRect[],
): CanvasLayoutResult {
  let scaleFactor = 1;
  let width = rawWidth;
  let height = rawHeight;
  let wasCapped = false;

  if (rawWidth > MAX_CANVAS_SIZE || rawHeight > MAX_CANVAS_SIZE) {
    scaleFactor = Math.min(MAX_CANVAS_SIZE / rawWidth, MAX_CANVAS_SIZE / rawHeight);
    width = Math.max(MIN_CANVAS_SIZE, Math.floor(rawWidth * scaleFactor));
    height = Math.max(MIN_CANVAS_SIZE, Math.floor(rawHeight * scaleFactor));
    wasCapped = true;
  }

  return {
    rawWidth,
    rawHeight,
    width,
    height,
    scaleFactor,
    wasCapped,
    items,
  };
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  if (radius <= 0) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTextStamp(
  ctx: CanvasRenderingContext2D,
  stamp: TextStampSettings,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number,
): void {
  if (!stamp.enabled || !stamp.text.trim()) return;

  ctx.save();
  const fontPx = Math.max(10, Math.round(stamp.fontSize * scaleFactor));
  const padPx = Math.max(8, Math.round(stamp.padding * scaleFactor));
  ctx.font = `600 ${fontPx}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.globalAlpha = clamp(stamp.opacity, 5, 100) / 100;
  ctx.fillStyle = stamp.color;

  if (stamp.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = Math.max(4, Math.round(8 * scaleFactor));
    ctx.shadowOffsetY = Math.max(1, Math.round(2 * scaleFactor));
  }

  let x = padPx;
  let y = padPx;
  let textAlign: CanvasTextAlign = 'left';
  let textBaseline: CanvasTextBaseline = 'top';

  const pos: TextStampPosition = stamp.position;
  if (pos === 'top-center' || pos === 'center' || pos === 'bottom-center') {
    x = canvasWidth / 2;
    textAlign = 'center';
  } else if (pos === 'top-right' || pos === 'bottom-right') {
    x = canvasWidth - padPx;
    textAlign = 'right';
  }

  if (pos === 'center') {
    y = canvasHeight / 2;
    textBaseline = 'middle';
  } else if (pos === 'bottom-left' || pos === 'bottom-center' || pos === 'bottom-right') {
    y = canvasHeight - padPx;
    textBaseline = 'bottom';
  }

  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.fillText(stamp.text.trim(), x, y);
  ctx.restore();
}

export interface RenderCanvasOptions {
  selectedLayerId?: string | null;
  showSelectionHighlight?: boolean;
}

/**
 * Draws the full merged composition onto an HTMLCanvasElement.
 */
export function renderMergedCanvas(
  canvas: HTMLCanvasElement,
  images: MergerImage[],
  settings: MergerSettings,
  options?: RenderCanvasOptions,
): CanvasLayoutResult {
  const layout = calcCanvasLayout(images, settings);

  if (images.length === 0 || layout.width === 0 || layout.height === 0) {
    canvas.width = 0;
    canvas.height = 0;
    return layout;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return layout;

  canvas.width = layout.width;
  canvas.height = layout.height;

  // Background fill (PNG & WebP support alpha transparency; JPEG uses solid background)
  if (settings.transparentBg && (settings.format === 'png' || settings.format === 'webp')) {
    ctx.clearRect(0, 0, layout.width, layout.height);
  } else {
    ctx.fillStyle = settings.bgColor || '#ffffff';
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  const sf = layout.scaleFactor;
  const cornerRadiusPx = settings.cornerRadius * sf;
  const borderWidthPx = settings.borderWidth * sf;
  const shadowBlurPx = settings.shadowBlur * sf;

  const imageMap = new Map(images.map((im) => [im.id, im]));

  for (const item of layout.items) {
    const source = imageMap.get(item.id);
    if (!source?.img) continue;

    const cx = item.cx * sf;
    const cy = item.cy * sf;
    const drawW = item.w * sf;
    const drawH = item.h * sf;

    ctx.save();
    ctx.globalAlpha = item.opacity;
    ctx.translate(cx, cy);
    if (item.rotationDeg !== 0) {
      ctx.rotate((item.rotationDeg * Math.PI) / 180);
    }

    // Shadow pass (drawn on a solid box before clip)
    if (shadowBlurPx > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
      ctx.shadowBlur = shadowBlurPx;
      ctx.shadowOffsetY = Math.max(2, shadowBlurPx * 0.25);
      ctx.fillStyle = settings.transparentBg ? 'rgba(0,0,0,0.01)' : settings.bgColor;
      traceRoundedRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, cornerRadiusPx);
      ctx.fill();
      ctx.restore();
    }

    // Image clipped inside rounded rect (plus optional flip & CSS filter)
    ctx.save();
    traceRoundedRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, cornerRadiusPx);
    ctx.clip();

    if (source.flipH || source.flipV) {
      ctx.scale(source.flipH ? -1 : 1, source.flipV ? -1 : 1);
    }

    const filterCss = buildCssFilterString(source.filters);
    if (filterCss !== 'none' && 'filter' in ctx) {
      ctx.filter = filterCss;
    }

    const drawSource = getSharpenedImageSource(source.img, source.filters?.sharpen ?? 0);

    if (source.crop && source.crop.width > 0 && source.crop.height > 0) {
      const sx = clamp(source.crop.x, 0, Math.max(0, source.width - 1));
      const sy = clamp(source.crop.y, 0, Math.max(0, source.height - 1));
      const sw = clamp(source.crop.width, 1, Math.max(1, source.width - sx));
      const sh = clamp(source.crop.height, 1, Math.max(1, source.height - sy));
      ctx.drawImage(drawSource, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.drawImage(drawSource, -drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();

    // Border pass
    if (borderWidthPx > 0) {
      ctx.save();
      ctx.strokeStyle = settings.borderColor;
      ctx.lineWidth = borderWidthPx;
      traceRoundedRect(
        ctx,
        -drawW / 2 - borderWidthPx / 2,
        -drawH / 2 - borderWidthPx / 2,
        drawW + borderWidthPx,
        drawH + borderWidthPx,
        cornerRadiusPx > 0 ? cornerRadiusPx + borderWidthPx / 2 : 0,
      );
      ctx.stroke();
      ctx.restore();
    }

    // Optional selection outline in Overlay preview only
    if (
      options?.showSelectionHighlight &&
      settings.layout === 'overlay' &&
      options.selectedLayerId === source.id
    ) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(2, 2.5 * sf);
      ctx.setLineDash([8 * sf, 5 * sf]);
      ctx.strokeRect(-drawW / 2 - 4 * sf, -drawH / 2 - 4 * sf, drawW + 8 * sf, drawH + 8 * sf);
      ctx.restore();
    }

    ctx.restore();
  }

  // Optional Text Stamp overlay
  drawTextStamp(ctx, settings.textStamp, layout.width, layout.height, sf);

  return layout;
}

export function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  qualityPct: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = `image/${format}`;
    const q = format === 'png' ? undefined : clamp(qualityPct, 5, 100) / 100;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to encode canvas image.'));
        }
      },
      mimeType,
      q,
    );
  });
}

export interface TargetSizeOptimizationResult {
  blob: Blob;
  qualityPct: number;
  scalePct: number;
  reachedTarget: boolean;
}

/**
 * Binary-search quality (and downscale if necessary) so JPEG/WebP output fits under targetKb.
 */
export async function optimizeCanvasToTargetSize(
  sourceCanvas: HTMLCanvasElement,
  format: 'jpeg' | 'webp',
  targetKb: number,
): Promise<TargetSizeOptimizationResult> {
  const targetBytes = Math.max(5, targetKb) * 1024;
  let scalePct = 100;

  for (let pass = 0; pass < 4; pass++) {
    let workingCanvas = sourceCanvas;
    if (scalePct < 100) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(1, Math.round((sourceCanvas.width * scalePct) / 100));
      scaled.height = Math.max(1, Math.round((sourceCanvas.height * scalePct) / 100));
      const sctx = scaled.getContext('2d');
      if (sctx) {
        sctx.drawImage(sourceCanvas, 0, 0, scaled.width, scaled.height);
      }
      workingCanvas = scaled;
    }

    let low = 10;
    let high = 96;
    let bestBlob: Blob | null = null;
    let bestQ = 10;

    // Quick check at 92 first
    const topBlob = await canvasToBlobAsync(workingCanvas, format, 92);
    if (topBlob.size <= targetBytes) {
      return {
        blob: topBlob,
        qualityPct: 92,
        scalePct,
        reachedTarget: true,
      };
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const blob = await canvasToBlobAsync(workingCanvas, format, mid);
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestQ = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestBlob) {
      return {
        blob: bestBlob,
        qualityPct: bestQ,
        scalePct,
        reachedTarget: true,
      };
    }

    scalePct = Math.round(scalePct * 0.72);
    if (scalePct < 25) break;
  }

  // Fallback smallest possible blob
  const minBlob = await canvasToBlobAsync(sourceCanvas, format, 10);
  return {
    blob: minBlob,
    qualityPct: 10,
    scalePct: 100,
    reachedTarget: minBlob.size <= targetBytes,
  };
}

/**
 * Pure zero-dependency PDF 1.4 generator embedding a raw DCTDecode JPEG stream.
 * Produces a genuine print-ready PDF matching the exact aspect ratio (72pt per inch @ 150 DPI).
 */
export function buildPdfFromJpegBytes(
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  dpi = 150,
): Uint8Array<ArrayBuffer> {
  const safeW = Math.max(1, Math.round(pixelWidth));
  const safeH = Math.max(1, Math.round(pixelHeight));
  const ptW = Math.max(36, Math.round((safeW / dpi) * 72));
  const ptH = Math.max(36, Math.round((safeH / dpi) * 72));

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushStr = (s: string) => {
    pushBytes(encoder.encode(s));
  };

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // 1: Catalog
  offsets.push(byteLength);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  offsets.push(byteLength);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  offsets.push(byteLength);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // 4: Image XObject
  offsets.push(byteLength);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${safeW} /Height ${safeH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // 5: Content stream
  const contentStream = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(byteLength);
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`,
  );

  // xref
  const xrefStart = byteLength;
  pushStr(`xref\n0 ${offsets.length}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const output = new Uint8Array(new ArrayBuffer(byteLength));
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.length;
  }
  return output;
}

export function loadImageElementAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data'));
    img.src = src;
  });
}

/**
 * Computes a normalized focal point (0..1, 0..1) using local Sobel-like luminance
 * gradient energy over a 48x48 downsampled canvas grid, weighted slightly toward center.
 */
export function detectSmartFocalPoint(
  source: HTMLImageElement | HTMLCanvasElement,
): { focalX: number; focalY: number } {
  const sampleSize = 48;
  const offscreen = document.createElement('canvas');
  offscreen.width = sampleSize;
  offscreen.height = sampleSize;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return { focalX: 0.5, focalY: 0.5 };

  ctx.drawImage(source, 0, 0, sampleSize, sampleSize);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  } catch {
    return { focalX: 0.5, focalY: 0.5 };
  }

  const lum = new Float32Array(sampleSize * sampleSize);
  for (let i = 0; i < sampleSize * sampleSize; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;

  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const idx = y * sampleSize + x;
      const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gy = Math.abs(lum[idx + sampleSize] - lum[idx - sampleSize]);
      const edgeEnergy = gx + gy;
      // Gentle center-bias prior so uniform borders don't pull focal point to corners
      const nx = x / (sampleSize - 1);
      const ny = y / (sampleSize - 1);
      const distFromCenter = Math.hypot(nx - 0.5, ny - 0.5);
      const centerWeight = Math.max(0.25, 1.15 - distFromCenter);
      const weight = Math.pow(edgeEnergy, 1.3) * centerWeight;
      weightedX += nx * weight;
      weightedY += ny * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight <= 1e-3) {
    return { focalX: 0.5, focalY: 0.5 };
  }

  return {
    focalX: Number(clamp(weightedX / totalWeight, 0.1, 0.9).toFixed(3)),
    focalY: Number(clamp(weightedY / totalWeight, 0.1, 0.9).toFixed(3)),
  };
}

/**
 * Analyzes an image (or its cropped region) on a 48x48 grid to detect both its
 * Sobel luminance focal centroid AND its tight active content-edge bounding box
 * (ignoring flat/uniform outer margins or transparent padding).
 */
export function detectContentSignal(
  source: HTMLImageElement | HTMLCanvasElement,
  crop?: Pick<CropRect, 'x' | 'y' | 'width' | 'height'>,
): ContentAnalysisSignal {
  const defaultSignal: ContentAnalysisSignal = {
    focalX: 0.5,
    focalY: 0.5,
    contentBounds: { left: 0, top: 0, right: 1, bottom: 1 },
    edgeDensity: 0,
  };
  const sampleSize = 48;
  const offscreen = document.createElement('canvas');
  offscreen.width = sampleSize;
  offscreen.height = sampleSize;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return defaultSignal;

  if (crop && crop.width > 0 && crop.height > 0) {
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, sampleSize, sampleSize);
  } else {
    ctx.drawImage(source, 0, 0, sampleSize, sampleSize);
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  } catch {
    return defaultSignal;
  }

  const lum = new Float32Array(sampleSize * sampleSize);
  const alpha = new Float32Array(sampleSize * sampleSize);
  for (let i = 0; i < sampleSize * sampleSize; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    alpha[i] = data[i * 4 + 3];
  }

  // Sample average border RGB/alpha to detect uniform letterbox or background padding
  const corners = [
    0,
    sampleSize - 1,
    (sampleSize - 1) * sampleSize,
    sampleSize * sampleSize - 1,
  ];
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let bgA = 0;
  for (const ci of corners) {
    bgR += data[ci * 4];
    bgG += data[ci * 4 + 1];
    bgB += data[ci * 4 + 2];
    bgA += data[ci * 4 + 3];
  }
  bgR /= 4;
  bgG /= 4;
  bgB /= 4;
  bgA /= 4;

  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let totalEnergy = 0;

  let minX = sampleSize;
  let minY = sampleSize;
  let maxX = -1;
  let maxY = -1;

  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const idx = y * sampleSize + x;
      const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gy = Math.abs(lum[idx + sampleSize] - lum[idx - sampleSize]);
      const edgeEnergy = gx + gy;
      totalEnergy += edgeEnergy;

      const nx = x / (sampleSize - 1);
      const ny = y / (sampleSize - 1);
      const distFromCenter = Math.hypot(nx - 0.5, ny - 0.5);
      const centerWeight = Math.max(0.25, 1.15 - distFromCenter);
      const weight = Math.pow(edgeEnergy, 1.3) * centerWeight;
      weightedX += nx * weight;
      weightedY += ny * weight;
      totalWeight += weight;

      const colorDelta =
        Math.abs(data[idx * 4] - bgR) +
        Math.abs(data[idx * 4 + 1] - bgG) +
        Math.abs(data[idx * 4 + 2] - bgB);
      const isOpaqueContent = alpha[idx] > 24 && (bgA < 24 || colorDelta > 28 || edgeEnergy > 18);
      if (isOpaqueContent) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const focalX =
    totalWeight > 1e-3 ? Number(clamp(weightedX / totalWeight, 0.1, 0.9).toFixed(3)) : 0.5;
  const focalY =
    totalWeight > 1e-3 ? Number(clamp(weightedY / totalWeight, 0.1, 0.9).toFixed(3)) : 0.5;

  let left = 0;
  let top = 0;
  let right = 1;
  let bottom = 1;
  if (maxX > minX + 1 && maxY > minY + 1) {
    left = Number(clamp((minX - 1) / (sampleSize - 1), 0, 0.45).toFixed(3));
    top = Number(clamp((minY - 1) / (sampleSize - 1), 0, 0.45).toFixed(3));
    right = Number(clamp((maxX + 1) / (sampleSize - 1), 0.55, 1).toFixed(3));
    bottom = Number(clamp((maxY + 1) / (sampleSize - 1), 0.55, 1).toFixed(3));
  }

  const interiorCount = (sampleSize - 2) * (sampleSize - 2);
  return {
    focalX,
    focalY,
    contentBounds: { left, top, right, bottom },
    edgeDensity: Number((totalEnergy / Math.max(1, interiorCount)).toFixed(2)),
  };
}

/**
 * Resamples an individual MergerImage to targetW x targetH while preserving
 * existing crop coordinates proportionally if present.
 */
export async function resizeImageElementAsync(
  image: MergerImage,
  targetW: number,
  targetH: number,
): Promise<MergerImage> {
  if (!image.img) return image;
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round(targetH));
  const scaleX = w / Math.max(1, image.width);
  const scaleY = h / Math.max(1, image.height);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.img, 0, 0, w, h);

  const src = canvas.toDataURL('image/png');
  const nextImg = await loadImageElementAsync(src);
  const nextSize = Math.round((src.length * 3) / 4);

  const nextCrop = image.crop
    ? {
        ...image.crop,
        x: Math.round(image.crop.x * scaleX),
        y: Math.round(image.crop.y * scaleY),
        width: Math.max(1, Math.round(image.crop.width * scaleX)),
        height: Math.max(1, Math.round(image.crop.height * scaleY)),
      }
    : undefined;

  return {
    ...image,
    src,
    img: nextImg,
    width: w,
    height: h,
    size: nextSize,
    crop: nextCrop,
  };
}

/**
 * Stamps a uniform watermark onto an individual MergerImage canvas before merging.
 */
export async function watermarkImageElementAsync(
  image: MergerImage,
  opts: BatchWatermarkOptions,
): Promise<MergerImage> {
  if (!image.img || !opts.text.trim()) return image;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, image.width);
  canvas.height = Math.max(1, image.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;

  ctx.drawImage(image.img, 0, 0, canvas.width, canvas.height);

  const pad = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
  const scaledFont = Math.max(
    12,
    Math.round((opts.fontSize * Math.max(canvas.width, 400)) / 720),
  );
  ctx.save();
  ctx.font = `600 ${scaledFont}px "Plus Jakarta Sans", -apple-system, sans-serif`;
  ctx.fillStyle = opts.color;
  ctx.globalAlpha = clamp(opts.opacity, 5, 100) / 100;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;

  const label = opts.text.trim();
  if (opts.position === 'tiled') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stepX = Math.max(180, scaledFont * label.length * 0.8);
    const stepY = Math.max(120, scaledFont * 4);
    for (let y = stepY / 2; y < canvas.height + stepY; y += stepY) {
      for (let x = stepX / 2; x < canvas.width + stepX; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 7);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
  } else {
    let x = pad;
    let y = pad;
    let textAlign: CanvasTextAlign = 'left';
    let textBaseline: CanvasTextBaseline = 'top';

    if (
      opts.position === 'top-center' ||
      opts.position === 'center' ||
      opts.position === 'bottom-center'
    ) {
      x = canvas.width / 2;
      textAlign = 'center';
    } else if (opts.position === 'top-right' || opts.position === 'bottom-right') {
      x = canvas.width - pad;
      textAlign = 'right';
    }

    if (opts.position === 'center') {
      y = canvas.height / 2;
      textBaseline = 'middle';
    } else if (
      opts.position === 'bottom-left' ||
      opts.position === 'bottom-center' ||
      opts.position === 'bottom-right'
    ) {
      y = canvas.height - pad;
      textBaseline = 'bottom';
    }

    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(label, x, y);
  }
  ctx.restore();

  const src = canvas.toDataURL('image/png');
  const nextImg = await loadImageElementAsync(src);
  return {
    ...image,
    src,
    img: nextImg,
    size: Math.round((src.length * 3) / 4),
  };
}

/**
 * Renders a single MergerImage with its crop, rotation (0-360°), flips, and filters
 * into an encoded Blob suitable for individual/ZIP export.
 */
export async function renderProcessedImageBlobAsync(
  image: MergerImage,
  format: OutputFormat,
  qualityPct: number,
  transparentBg: boolean,
  bgColor: string,
): Promise<Blob> {
  const eff = getEffectiveImageDimensions(image);
  const rot = normalizeDegrees(image.rotation ?? 0);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const outW = rot === 0 ? eff.width : Math.max(1, Math.ceil(eff.width * cos + eff.height * sin));
  const outH = rot === 0 ? eff.height : Math.max(1, Math.ceil(eff.width * sin + eff.height * cos));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx || !image.img) {
    throw new Error('Image not ready for export');
  }

  if (transparentBg && (format === 'png' || format === 'webp')) {
    ctx.clearRect(0, 0, outW, outH);
  } else {
    ctx.fillStyle = bgColor || '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  if (rot !== 0) {
    ctx.rotate(rad);
  }
  if (image.flipH || image.flipV) {
    ctx.scale(image.flipH ? -1 : 1, image.flipV ? -1 : 1);
  }
  const filterCss = buildCssFilterString(image.filters);
  if (filterCss !== 'none' && 'filter' in ctx) {
    ctx.filter = filterCss;
  }

  const drawSource = getSharpenedImageSource(image.img, image.filters?.sharpen ?? 0);

  if (image.crop && image.crop.width > 0 && image.crop.height > 0) {
    const sx = clamp(image.crop.x, 0, Math.max(0, image.width - 1));
    const sy = clamp(image.crop.y, 0, Math.max(0, image.height - 1));
    const sw = clamp(image.crop.width, 1, Math.max(1, image.width - sx));
    const sh = clamp(image.crop.height, 1, Math.max(1, image.height - sy));
    ctx.drawImage(drawSource, sx, sy, sw, sh, -eff.width / 2, -eff.height / 2, eff.width, eff.height);
  } else {
    ctx.drawImage(drawSource, -eff.width / 2, -eff.height / 2, eff.width, eff.height);
  }
  ctx.restore();

  return canvasToBlobAsync(canvas, format, qualityPct);
}

/**
 * Pure 3x3 sharpening convolution kernel:
 *   [  0,   -k,   0 ]
 *   [ -k, 1+4k,  -k ]
 *   [  0,   -k,   0 ]
 * where k scales smoothly from 0..0.85 based on strengthPct (0..100).
 * Preserves alpha channel and clamps RGB values safely to [0, 255].
 */
export function convolveSharpenImageData(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  strengthPct: number,
): Uint8ClampedArray {
  const safeStrength = clamp(strengthPct, 0, 100);
  if (safeStrength <= 0 || width < 3 || height < 3) {
    return new Uint8ClampedArray(src);
  }

  const k = (safeStrength / 100) * 0.85;
  const centerWeight = 1 + 4 * k;
  const out = new Uint8ClampedArray(src.length);
  const rowStride = width * 4;

  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDown = y < height - 1 ? y + 1 : height - 1;
    const rowOff = y * rowStride;
    const upOff = yUp * rowStride;
    const downOff = yDown * rowStride;

    for (let x = 0; x < width; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < width - 1 ? x + 1 : width - 1;
      const idx = rowOff + x * 4;
      const leftIdx = rowOff + xLeft * 4;
      const rightIdx = rowOff + xRight * 4;
      const topIdx = upOff + x * 4;
      const botIdx = downOff + x * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          src[idx + c] * centerWeight -
          (src[leftIdx + c] + src[rightIdx + c] + src[topIdx + c] + src[botIdx + c]) * k;
        out[idx + c] = val < 0 ? 0 : val > 255 ? 255 : Math.round(val);
      }
      out[idx + 3] = src[idx + 3];
    }
  }

  return out;
}

const sharpenedCanvasCache = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>();

export function getSharpenedImageSource(
  img: HTMLImageElement,
  sharpenPct: number,
): HTMLImageElement | HTMLCanvasElement {
  const rounded = Math.round(clamp(sharpenPct || 0, 0, 100));
  if (rounded <= 0) return img;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 3 || h < 3) return img;

  let byStrength = sharpenedCanvasCache.get(img);
  if (byStrength?.has(rounded)) {
    return byStrength.get(rounded)!;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, w, h);

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const sharpened = convolveSharpenImageData(imgData.data, w, h, rounded);
    imgData.data.set(sharpened);
    ctx.putImageData(imgData, 0, 0);
  } catch {
    return img;
  }

  if (!byStrength) {
    byStrength = new Map();
    sharpenedCanvasCache.set(img, byStrength);
  }
  if (byStrength.size > 6) {
    const firstKey = byStrength.keys().next().value;
    if (firstKey !== undefined) byStrength.delete(firstKey);
  }
  byStrength.set(rounded, offscreen);
  return offscreen;
}

/**
 * Generates a lightweight thumbnail data URL for the visual Undo/Redo history timeline.
 */
export function renderCanvasThumbnailDataUrl(
  images: MergerImage[],
  settings: MergerSettings,
  maxW = 144,
  maxH = 88,
): string | undefined {
  if (typeof document === 'undefined' || images.length === 0) return undefined;
  try {
    const full = document.createElement('canvas');
    renderMergedCanvas(full, images, settings, { showSelectionHighlight: false });
    if (full.width <= 0 || full.height <= 0) return undefined;

    const scale = Math.min(maxW / full.width, maxH / full.height, 1);
    const tw = Math.max(24, Math.round(full.width * scale));
    const th = Math.max(18, Math.round(full.height * scale));
    const thumb = document.createElement('canvas');
    thumb.width = tw;
    thumb.height = th;
    const tctx = thumb.getContext('2d');
    if (!tctx) return undefined;

    if (!settings.transparentBg || settings.format === 'jpeg') {
      tctx.fillStyle = settings.bgColor || '#ffffff';
      tctx.fillRect(0, 0, tw, th);
    }
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'medium';
    tctx.drawImage(full, 0, 0, tw, th);
    return thumb.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

/**
 * Pure deterministic navigation across Undo (past) and Redo (future) timeline stacks.
 */
export function navigateHistoryTimeline<T>(
  past: T[],
  current: T,
  future: T[],
  target: { zone: 'past' | 'future'; index: number },
): { past: T[]; current: T; future: T[] } | null {
  if (target.zone === 'past') {
    if (target.index < 0 || target.index >= past.length) return null;
    const nextCurrent = past[target.index];
    const nextPast = past.slice(0, target.index);
    const movedToFuture = [...past.slice(target.index + 1), current];
    return {
      past: nextPast,
      current: nextCurrent,
      future: [...movedToFuture, ...future],
    };
  }

  if (target.index < 0 || target.index >= future.length) return null;
  const nextCurrent = future[target.index];
  const movedToPast = [current, ...future.slice(0, target.index)];
  return {
    past: [...past, ...movedToPast],
    current: nextCurrent,
    future: future.slice(target.index + 1),
  };
}

export interface SmartAlignmentInput extends ImageDimensionInput {
  signal: ContentAnalysisSignal;
}

/**
 * Pure content-aware layout engine that aligns images based on detected
 * focal centroids and tight active content edges rather than a rigid uniform grid.
 */
export function computeSmartAlignment(
  items: SmartAlignmentInput[],
  currentLayout: LayoutMode,
  mode: SmartAlignmentMode,
): AutoArrangeResult {
  if (items.length === 0) {
    return {
      settingsPatch: {},
      imagePatches: [],
      summary: 'Load images to run Smart Alignment.',
    };
  }

  const nodes = items.map((im) => {
    const eff = getEffectiveImageDimensions(im);
    const left = clamp(im.signal.contentBounds.left, 0, 0.48);
    const right = clamp(im.signal.contentBounds.right, left + 0.08, 1);
    const top = clamp(im.signal.contentBounds.top, 0, 0.48);
    const bottom = clamp(im.signal.contentBounds.bottom, top + 0.08, 1);
    return {
      id: im.id,
      width: eff.width,
      height: eff.height,
      opacity: im.opacity ?? 100,
      focalX: clamp(im.signal.focalX, 0.05, 0.95),
      focalY: clamp(im.signal.focalY, 0.05, 0.95),
      edgeDensity: im.signal.edgeDensity,
      bounds: { left, top, right, bottom },
      contentW: Math.max(8, (right - left) * eff.width),
      contentH: Math.max(8, (bottom - top) * eff.height),
    };
  });

  if (nodes.length === 1) {
    const n = nodes[0];
    return {
      settingsPatch: { layout: 'overlay', padding: 32 },
      imagePatches: [
        {
          id: n.id,
          x: Math.round(-(n.focalX - 0.5) * n.width),
          y: Math.round(-(n.focalY - 0.5) * n.height),
          scale: 100,
          rotation: 0,
          opacity: n.opacity <= 5 ? 100 : n.opacity,
        },
      ],
      summary: 'Centered single subject by detected focal point',
    };
  }

  // 1. Focal Eye-Line Alignment (locks every image's focal centroid onto a shared axis)
  if (mode === 'focal-lineup') {
    const alignVertically = currentLayout === 'vertical';
    const gap = 24;

    if (alignVertically) {
      const targetW = clamp(
        Math.round(nodes.reduce((s, n) => s + n.width, 0) / nodes.length),
        220,
        720,
      );
      const scaled = nodes.map((n) => {
        const scalePct = clamp(Math.round((targetW / n.width) * 100), 15, 200);
        const w = (n.width * scalePct) / 100;
        const h = (n.height * scalePct) / 100;
        return { n, scalePct, w, h };
      });
      const totalH = scaled.reduce((s, item) => s + item.h, 0) + gap * (scaled.length - 1);
      let cursorY = -totalH / 2;

      const imagePatches = scaled.map((item) => {
        const cy = Math.round(cursorY + item.h / 2);
        const cx = Math.round(-(item.n.focalX - 0.5) * item.w);
        cursorY += item.h + gap;
        return {
          id: item.n.id,
          x: cx,
          y: cy,
          scale: item.scalePct,
          rotation: 0,
          opacity: item.n.opacity <= 5 ? 100 : item.n.opacity,
        };
      });

      return {
        settingsPatch: { layout: 'overlay', padding: 32 },
        imagePatches,
        summary: `Focal Eye-Line (Vertical) · aligned ${nodes.length} subjects on focal X`,
      };
    }

    const targetH = clamp(
      Math.round(nodes.reduce((s, n) => s + n.height, 0) / nodes.length),
      220,
      640,
    );
    const scaled = nodes.map((n) => {
      const scalePct = clamp(Math.round((targetH / n.height) * 100), 15, 200);
      const w = (n.width * scalePct) / 100;
      const h = (n.height * scalePct) / 100;
      return { n, scalePct, w, h };
    });
    const totalW = scaled.reduce((s, item) => s + item.w, 0) + gap * (scaled.length - 1);
    let cursorX = -totalW / 2;

    const imagePatches = scaled.map((item) => {
      const cx = Math.round(cursorX + item.w / 2);
      // Place image center so its focal Y point lands cleanly at canvas y = 0
      const cy = Math.round(-(item.n.focalY - 0.5) * item.h);
      cursorX += item.w + gap;
      return {
        id: item.n.id,
        x: cx,
        y: cy,
        scale: item.scalePct,
        rotation: 0,
        opacity: item.n.opacity <= 5 ? 100 : item.n.opacity,
      };
    });

    return {
      settingsPatch: { layout: 'overlay', padding: 32 },
      imagePatches,
      summary: `Focal Eye-Line · aligned ${nodes.length} subjects on shared focal Y`,
    };
  }

  // 2. Content-Edge Snap (compensates empty outer margins & snaps detected content edges)
  if (mode === 'edge-snap') {
    const targetContentH = clamp(
      Math.round(nodes.reduce((s, n) => s + n.contentH, 0) / nodes.length),
      200,
      600,
    );
    const contentGap = 16;

    const scaled = nodes.map((n) => {
      const scalePct = clamp(Math.round((targetContentH / n.contentH) * 100), 15, 200);
      const w = (n.width * scalePct) / 100;
      const h = (n.height * scalePct) / 100;
      const cLeftOff = (n.bounds.left - 0.5) * w; // negative offset from center to left content edge
      const cRightOff = (n.bounds.right - 0.5) * w; // positive offset from center to right content edge
      const cMidYOff = ((n.bounds.top + n.bounds.bottom) / 2 - 0.5) * h;
      const actualContentW = cRightOff - cLeftOff;
      return { n, scalePct, w, h, cLeftOff, cRightOff, cMidYOff, actualContentW };
    });

    const totalContentW =
      scaled.reduce((s, item) => s + item.actualContentW, 0) + contentGap * (scaled.length - 1);
    let edgeCursor = -totalContentW / 2;

    const imagePatches = scaled.map((item) => {
      // Position layer center so its left content edge aligns exactly at edgeCursor
      const cx = Math.round(edgeCursor - item.cLeftOff);
      // Align detected vertical content center onto y = 0
      const cy = Math.round(-item.cMidYOff);
      edgeCursor += item.actualContentW + contentGap;
      return {
        id: item.n.id,
        x: cx,
        y: cy,
        scale: item.scalePct,
        rotation: 0,
        opacity: item.n.opacity <= 5 ? 100 : item.n.opacity,
      };
    });

    return {
      settingsPatch: { layout: 'overlay', padding: 28 },
      imagePatches,
      summary: `Content-Edge Snap · margin-compensated ${contentGap}px edge alignment`,
    };
  }

  // 3. Focal Cluster (places strongest focal subject as hero anchor, satellites around perimeter)
  const sortedByStrength = [...nodes].sort(
    (a, b) => b.edgeDensity * b.contentW - a.edgeDensity * a.contentW,
  );
  const hero = sortedByStrength[0];
  const satellites = sortedByStrength.slice(1);
  const heroTargetH = 440;
  const heroScalePct = clamp(Math.round((heroTargetH / hero.height) * 100), 20, 180);
  const heroW = (hero.width * heroScalePct) / 100;
  const heroH = (hero.height * heroScalePct) / 100;

  const patches: AutoArrangeResult['imagePatches'] = [
    {
      id: hero.id,
      x: Math.round(-(hero.focalX - 0.5) * heroW * 0.6),
      y: Math.round(-(hero.focalY - 0.5) * heroH * 0.6),
      scale: heroScalePct,
      rotation: 0,
      opacity: hero.opacity <= 5 ? 100 : hero.opacity,
    },
  ];

  const satTargetH = 240;
  const satGap = 24;
  const satScaled = satellites.map((s) => {
    const scalePct = clamp(Math.round((satTargetH / s.height) * 100), 15, 160);
    return {
      node: s,
      scalePct,
      w: (s.width * scalePct) / 100,
      h: (s.height * scalePct) / 100,
    };
  });

  // Stack satellites neatly on the right & bottom-left flanks without overlapping hero
  const rightCount = Math.ceil(satScaled.length / 2);
  const rightColumn = satScaled.slice(0, rightCount);
  const bottomRow = satScaled.slice(rightCount);

  if (rightColumn.length > 0) {
    const colTotalH =
      rightColumn.reduce((sum, s) => sum + s.h, 0) + satGap * (rightColumn.length - 1);
    let cyCursor = -colTotalH / 2;
    const maxSatW = Math.max(...rightColumn.map((s) => s.w));
    const colX = Math.round(heroW / 2 + satGap + maxSatW / 2);
    for (const sat of rightColumn) {
      patches.push({
        id: sat.node.id,
        x: Math.round(colX - (sat.node.focalX - 0.5) * 24),
        y: Math.round(cyCursor + sat.h / 2),
        scale: sat.scalePct,
        rotation: 0,
        opacity: sat.node.opacity <= 5 ? 100 : sat.node.opacity,
      });
      cyCursor += sat.h + satGap;
    }
  }

  if (bottomRow.length > 0) {
    const rowTotalW = bottomRow.reduce((sum, s) => sum + s.w, 0) + satGap * (bottomRow.length - 1);
    let cxCursor = -rowTotalW / 2;
    const maxSatH = Math.max(...bottomRow.map((s) => s.h));
    const rowY = Math.round(heroH / 2 + satGap + maxSatH / 2);
    for (const sat of bottomRow) {
      patches.push({
        id: sat.node.id,
        x: Math.round(cxCursor + sat.w / 2),
        y: Math.round(rowY - (sat.node.focalY - 0.5) * 20),
        scale: sat.scalePct,
        rotation: 0,
        opacity: sat.node.opacity <= 5 ? 100 : sat.node.opacity,
      });
      cxCursor += sat.w + satGap;
    }
  }

  const patchMap = new Map(patches.map((p) => [p.id, p]));
  return {
    settingsPatch: { layout: 'overlay', padding: 32 },
    imagePatches: items.map((im) => patchMap.get(im.id)!),
    summary: `Focal Cluster · anchored hero + ${satellites.length} edge-balanced satellites`,
  };
}

/**
 * Computes exact final export pixel dimensions from canvas dimensions and ExportDimensionsConfig.
 */
export function computeExportDimensions(
  canvasWidth: number,
  canvasHeight: number,
  config: ExportDimensionsConfig,
): { width: number; height: number; scaled: boolean } {
  const cw = Math.max(0, Math.round(canvasWidth));
  const ch = Math.max(0, Math.round(canvasHeight));
  if (cw === 0 || ch === 0) return { width: 0, height: 0, scaled: false };

  if (config.dimensionMode === 'custom-scale') {
    const pct = clamp(Math.round(config.customScale || 100), 10, 200);
    if (pct === 100) return { width: cw, height: ch, scaled: false };
    return {
      width: Math.max(1, Math.round((cw * pct) / 100)),
      height: Math.max(1, Math.round((ch * pct) / 100)),
      scaled: true,
    };
  }

  if (config.dimensionMode === 'fit-box') {
    const maxW = Math.max(32, Math.round(config.maxWidth || cw));
    const maxH = Math.max(32, Math.round(config.maxHeight || ch));
    const ratio = Math.min(maxW / cw, maxH / ch, 1);
    const outW = Math.max(1, Math.round(cw * ratio));
    const outH = Math.max(1, Math.round(ch * ratio));
    return {
      width: outW,
      height: outH,
      scaled: outW !== cw || outH !== ch,
    };
  }

  return { width: cw, height: ch, scaled: false };
}

export function scaleCanvasToDimensions(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const tw = Math.max(1, Math.round(targetWidth));
  const th = Math.max(1, Math.round(targetHeight));
  if (sourceCanvas.width === tw && sourceCanvas.height === th) {
    return sourceCanvas;
  }
  const scaled = document.createElement('canvas');
  scaled.width = tw;
  scaled.height = th;
  const ctx = scaled.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, tw, th);
  }
  return scaled;
}
