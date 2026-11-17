export type LayoutMode = 'horizontal' | 'vertical' | 'grid' | 'overlay';
export type AlignmentMode = 'start' | 'center' | 'end';
export type ScaleMode =
  | 'original'
  | 'fit-smallest'
  | 'fit-largest'
  | 'same-height'
  | 'same-width'
  | 'custom';

export type OutputFormat = 'png' | 'jpeg' | 'webp';
export type PreviewBackdrop = 'checker' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

export type TextStampPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ImageFilters {
  brightness: number; // 50 - 150 (100 default)
  contrast: number; // 50 - 150 (100 default)
  saturation: number; // 0 - 200 (100 default)
  hue?: number; // -180 - 180 deg (0 default)
  grayscale: boolean;
  sharpen?: number; // 0 - 100 (0 default, 3x3 kernel convolution)
}

export interface ImageExifData {
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  orientation?: string;
  colorSpace?: string;
  gpsSummary?: string;
}

export interface ImageMetadataInfo {
  format: string;
  mimeType: string;
  fileSizeBytes: number;
  originalWidth: number;
  originalHeight: number;
  bitDepth?: string;
  colorType?: string;
  hasAlpha?: boolean;
  colorProfile: string;
  dpi?: string;
  lastModified?: number;
  exif: ImageExifData;
}

export type CropAspectPreset =
  | 'free'
  | '1:1'
  | '4:3'
  | '16:9'
  | '3:2'
  | '3:4'
  | 'id-card';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectPreset?: CropAspectPreset;
  focalX?: number; // normalized 0..1
  focalY?: number; // normalized 0..1
}

export type BatchResizeMode = 'max-edge' | 'width' | 'height' | 'percent';

export interface BatchWatermarkOptions {
  text: string;
  position: TextStampPosition | 'tiled';
  fontSize: number;
  color: string;
  opacity: number;
}

export type BatchRenameCase = 'preserve' | 'lower' | 'upper' | 'kebab' | 'snake';

export interface BatchRenameOptions {
  pattern: string;
  startNumber: number;
  step: number;
  zeroPad: number;
  caseMode: BatchRenameCase;
  preserveExtension: boolean;
}

export interface MergerImage {
  id: string;
  name: string;
  size: number;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  metadata?: ImageMetadataInfo;
  src: string; // data URL or object URL
  img?: HTMLImageElement;
  crop?: CropRect;
  // Overlay transform properties
  x: number;
  y: number;
  scale: number; // %
  rotation: number; // deg (0..360)
  opacity: number; // % (0..100)
  // Per-image non-destructive edits
  flipH: boolean;
  flipV: boolean;
  filters: ImageFilters;
}

export interface TextStampSettings {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number; // 10 - 100
  position: TextStampPosition;
  padding: number;
  shadow: boolean;
}

export interface MergerSettings {
  layout: LayoutMode;
  spacing: number;
  padding: number;
  alignment: AlignmentMode;
  columns: number;
  autoColumns: boolean;
  scaleMode: ScaleMode;
  customScale: number;
  bgColor: string;
  transparentBg: boolean;
  borderWidth: number;
  borderColor: string;
  cornerRadius: number;
  shadowBlur: number;
  format: OutputFormat;
  quality: number; // 10 - 100
  filenamePrefix: string;
  textStamp: TextStampSettings;
}

export interface UserPreset {
  id: string;
  name: string;
  createdAt: number;
  settings: MergerSettings;
}

export interface WorkspaceTelemetry {
  totalExports: number;
  totalImagesProcessed: number;
  lastExportAt: number | null;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export interface OutputStats {
  width: number;
  height: number;
  rawWidth: number;
  rawHeight: number;
  scaleFactor: number;
  megapixels: string;
  aspectRatio: string;
  estimatedBytes: number | null;
  estimating: boolean;
}

export interface HistorySnapshot {
  id: string;
  label: string;
  timestamp: number;
  thumbnail?: string;
  images: MergerImage[];
  settings: MergerSettings;
  selectedLayerId: string | null;
}

export type SmartAlignmentMode = 'focal-lineup' | 'edge-snap' | 'focal-cluster';

export interface ContentBoundingBox {
  left: number; // normalized 0..1
  top: number; // normalized 0..1
  right: number; // normalized 0..1
  bottom: number; // normalized 0..1
}

export interface ContentAnalysisSignal {
  focalX: number; // normalized 0..1
  focalY: number; // normalized 0..1
  contentBounds: ContentBoundingBox;
  edgeDensity: number;
}

export type ExportDimensionMode = 'canvas' | 'fit-box' | 'custom-scale';

export interface ExportDimensionsConfig {
  dimensionMode: ExportDimensionMode;
  maxWidth: number;
  maxHeight: number;
  customScale: number; // percentage 10..200
}

export interface ExportPreset {
  id: string;
  name: string;
  createdAt: number;
  format: OutputFormat;
  quality: number;
  transparentBg: boolean;
  targetKb?: number;
  dimensionMode: ExportDimensionMode;
  maxWidth: number;
  maxHeight: number;
  customScale: number;
  filenamePrefix?: string;
  isBuiltIn?: boolean;
}
