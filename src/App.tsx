import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from './components/ConfirmModal';
import { ControlSidebar } from './components/ControlSidebar';
import { CropModal } from './components/CropModal';
import { ExportModal } from './components/ExportModal';
import { HeaderBar } from './components/HeaderBar';
import { ImageTray } from './components/ImageTray';
import { LayerPanel } from './components/LayerPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/ToastContainer';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import type {
  BatchRenameOptions,
  BatchResizeMode,
  BatchWatermarkOptions,
  CropAspectPreset,
  CropRect,
  ExportDimensionsConfig,
  ExportPreset,
  HistorySnapshot,
  ImageFilters,
  MergerImage,
  MergerSettings,
  OutputStats,
  PreviewBackdrop,
  SmartAlignmentMode,
  ThemeMode,
  ToastItem,
  UserPreset,
  WorkspaceTelemetry,
} from './types/merger';
import {
  CROP_ASPECT_RATIOS,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  MAX_IMAGES,
  applyBatchColorAdjustments,
  buildPdfFromJpegBytes,
  buildZipArchive,
  calcCanvasLayout,
  canvasToBlobAsync,
  clamp,
  computeAspectCropRect,
  computeAutoArrange,
  computeBatchResizeDimensions,
  computeExportDimensions,
  computeSmartAlignment,
  detectContentSignal,
  detectSmartFocalPoint,
  formatAspectRatio,
  formatBytes,
  generateBatchRenamedNames,
  loadImageElementAsync,
  navigateHistoryTimeline,
  optimizeCanvasToTargetSize,
  renderCanvasThumbnailDataUrl,
  renderMergedCanvas,
  renderProcessedImageBlobAsync,
  resizeImageElementAsync,
  sanitizeFilename,
  scaleCanvasToDimensions,
  watermarkImageElementAsync,
} from './utils/canvasEngine';
import { extractMetadataFromDataUrl, extractMetadataFromFile } from './utils/imageMetadata';
import type { SampleTemplateSpec } from './utils/sampleGenerator';
import {
  loadExportPresets,
  loadTelemetry,
  loadThemePreference,
  loadUserPresets,
  recordExportTelemetry,
  saveExportPresets,
  saveThemePreference,
  saveUserPresets,
} from './utils/storage';

const MAX_HISTORY = 25;

function cloneSnapshot(
  images: MergerImage[],
  settings: MergerSettings,
  selectedLayerId: string | null,
  label = 'Canvas edit',
  thumbnail?: string,
): HistorySnapshot {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    timestamp: Date.now(),
    thumbnail,
    images: images.map((im) => ({
      ...im,
      filters: { ...im.filters },
      crop: im.crop ? { ...im.crop } : undefined,
    })),
    settings: {
      ...settings,
      textStamp: { ...settings.textStamp },
    },
    selectedLayerId,
  };
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image data'));
    img.src = src;
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [images, setImages] = useState<MergerImage[]>([]);
  const [settings, setSettings] = useState<MergerSettings>(() => ({
    ...DEFAULT_SETTINGS,
    textStamp: { ...DEFAULT_SETTINGS.textStamp },
  }));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [backdrop, setBackdrop] = useState<PreviewBackdrop>('checker');
  const [theme, setTheme] = useState<ThemeMode>(() => loadThemePreference());
  const [userPresets, setUserPresets] = useState<UserPreset[]>(() => loadUserPresets());
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>(() => loadExportPresets());
  const [exportDimensions, setExportDimensions] = useState<ExportDimensionsConfig>({
    dimensionMode: 'canvas',
    maxWidth: 1920,
    maxHeight: 1080,
    customScale: 100,
  });
  const [telemetry, setTelemetry] = useState<WorkspaceTelemetry>(() => loadTelemetry());

  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);
  const [currentHistoryLabel, setCurrentHistoryLabel] = useState<string>('Initial workspace');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [resetViewSignal, setResetViewSignal] = useState(0);

  const [estimatedBytes, setEstimatedBytes] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const estimateTimeoutRef = useRef<number | null>(null);
  const currentHistoryLabelRef = useRef<string>(currentHistoryLabel);
  currentHistoryLabelRef.current = currentHistoryLabel;
  const rangePointerCommittedRef = useRef<boolean>(false);
  const lastSharpenCommitRef = useRef<number>(0);
  const lastColorCommitRef = useRef<number>(0);

  // Sync Tailwind dark mode class and data-theme on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const clearRangeFlag = () => {
      rangePointerCommittedRef.current = false;
    };
    window.addEventListener('pointerup', clearRangeFlag);
    window.addEventListener('pointercancel', clearRangeFlag);
    return () => {
      window.removeEventListener('pointerup', clearRangeFlag);
      window.removeEventListener('pointercancel', clearRangeFlag);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushHistory = useCallback(
    (
      snapImages: MergerImage[],
      snapSettings: MergerSettings,
      snapSelected: string | null,
      nextActionLabel = 'Canvas edit',
    ) => {
      const prevLabel = currentHistoryLabelRef.current;
      const thumb = renderCanvasThumbnailDataUrl(snapImages, snapSettings);
      setHistoryPast((prev) => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        cloneSnapshot(snapImages, snapSettings, snapSelected, prevLabel, thumb),
      ]);
      setHistoryFuture([]);
      currentHistoryLabelRef.current = nextActionLabel;
      setCurrentHistoryLabel(nextActionLabel);
    },
    [],
  );

  // Computed Layout Geometry
  const layoutSummary = useMemo(() => calcCanvasLayout(images, settings), [images, settings]);

  const currentThumbnail = useMemo(
    () => renderCanvasThumbnailDataUrl(images, settings),
    [images, settings],
  );

  const outputStats: OutputStats = useMemo(() => {
    const { width, height, rawWidth, rawHeight, scaleFactor } = layoutSummary;
    const mp = width > 0 && height > 0 ? ((width * height) / 1_000_000).toFixed(2) : '0.00';
    return {
      width,
      height,
      rawWidth,
      rawHeight,
      scaleFactor,
      megapixels: mp,
      aspectRatio: formatAspectRatio(width, height),
      estimatedBytes,
      estimating,
    };
  }, [layoutSummary, estimatedBytes, estimating]);

  const totalInputBytes = useMemo(
    () => images.reduce((sum, im) => sum + (im.size || 0), 0),
    [images],
  );

  // Render preview canvas whenever images, settings, or selectedLayerId change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    renderMergedCanvas(canvas, images, settings, {
      selectedLayerId,
      showSelectionHighlight: true,
    });

    if (images.length === 0) {
      setEstimatedBytes(null);
      setEstimating(false);
      return;
    }

    if (estimateTimeoutRef.current !== null) {
      window.clearTimeout(estimateTimeoutRef.current);
    }

    setEstimating(true);
    estimateTimeoutRef.current = window.setTimeout(async () => {
      try {
        const offscreen = document.createElement('canvas');
        renderMergedCanvas(offscreen, images, settings, { showSelectionHighlight: false });
        if (offscreen.width > 0 && offscreen.height > 0) {
          const blob = await canvasToBlobAsync(offscreen, settings.format, settings.quality);
          setEstimatedBytes(blob.size);
        } else {
          setEstimatedBytes(null);
        }
      } catch {
        setEstimatedBytes(null);
      } finally {
        setEstimating(false);
      }
    }, 180);

    return () => {
      if (estimateTimeoutRef.current !== null) {
        window.clearTimeout(estimateTimeoutRef.current);
      }
    };
  }, [images, settings, selectedLayerId]);

  // Process incoming Files (drop, browse, paste)
  const ingestFiles = useCallback(
    async (incoming: File[] | FileList) => {
      const fileList = Array.from(incoming);
      const imageFiles = fileList.filter((f) => f.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        showToast('Please select valid image files (PNG, JPEG, WebP, GIF, SVG).', 'error');
        return;
      }

      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        showToast(`Maximum limit of ${MAX_IMAGES} images reached.`, 'warning');
        return;
      }

      const batch = imageFiles.slice(0, remaining);
      if (imageFiles.length > remaining) {
        showToast(`Only the first ${remaining} images were added (limit ${MAX_IMAGES}).`, 'warning');
      }

      const loaded: MergerImage[] = [];
      let failed = 0;

      for (const file of batch) {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
          });
          const imgEl = await loadImageFromSrc(dataUrl);
          const w = imgEl.naturalWidth || imgEl.width;
          const h = imgEl.naturalHeight || imgEl.height;
          const metadata = await extractMetadataFromFile(file, w, h);
          loaded.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name || 'pasted-image.png',
            size: file.size || Math.round((dataUrl.length * 3) / 4),
            width: w,
            height: h,
            originalWidth: metadata.originalWidth,
            originalHeight: metadata.originalHeight,
            metadata,
            src: dataUrl,
            img: imgEl,
            x: 0,
            y: 0,
            scale: 100,
            rotation: 0,
            opacity: 100,
            flipH: false,
            flipV: false,
            filters: { ...DEFAULT_FILTERS },
          });
        } catch {
          failed++;
        }
      }

      if (loaded.length > 0) {
        pushHistory(
          images,
          settings,
          selectedLayerId,
          `Added ${loaded.length} ${loaded.length === 1 ? 'image' : 'images'}`,
        );
        setImages((prev) => [...prev, ...loaded]);
        setSelectedLayerId((curr) => curr ?? loaded[0].id);
        showToast(
          failed > 0
            ? `${loaded.length} image(s) added, ${failed} failed to decode`
            : `${loaded.length} image(s) added`,
          failed > 0 ? 'warning' : 'success',
        );
      } else if (failed > 0) {
        showToast('Failed to decode selected image files.', 'error');
      }
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  // Paste handler (Ctrl+V & button)
  const handlePasteFromClipboardButton = useCallback(async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
        showToast('Press Ctrl+V / Cmd+V directly to paste an image from your clipboard.', 'info');
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split('/')[1] || 'png';
          files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imgType }));
        }
      }
      if (files.length > 0) {
        await ingestFiles(files);
      } else {
        showToast('No image found on your clipboard.', 'warning');
      }
    } catch {
      showToast('Clipboard access requires permission — try pressing Ctrl+V directly.', 'info');
    }
  }, [ingestFiles, showToast]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        ingestFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [ingestFiles]);

  // Undo / Redo / Direct Timeline Jump handlers
  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    const currentSnap = cloneSnapshot(
      images,
      settings,
      selectedLayerId,
      currentHistoryLabelRef.current,
      renderCanvasThumbnailDataUrl(images, settings),
    );
    setHistoryFuture((f) => [currentSnap, ...f]);
    setHistoryPast((p) => p.slice(0, -1));
    setImages(prev.images);
    setSettings(prev.settings);
    setSelectedLayerId(prev.selectedLayerId);
    setSelectedImageIds((sel) => {
      const valid = new Set(prev.images.map((im) => im.id));
      return sel.filter((id) => valid.has(id));
    });
    currentHistoryLabelRef.current = prev.label;
    setCurrentHistoryLabel(prev.label);
    showToast(`Undid to "${prev.label}"`, 'info');
  }, [historyPast, images, settings, selectedLayerId, showToast]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const currentSnap = cloneSnapshot(
      images,
      settings,
      selectedLayerId,
      currentHistoryLabelRef.current,
      renderCanvasThumbnailDataUrl(images, settings),
    );
    setHistoryPast((p) => [...p, currentSnap]);
    setHistoryFuture((f) => f.slice(1));
    setImages(next.images);
    setSettings(next.settings);
    setSelectedLayerId(next.selectedLayerId);
    setSelectedImageIds((sel) => {
      const valid = new Set(next.images.map((im) => im.id));
      return sel.filter((id) => valid.has(id));
    });
    currentHistoryLabelRef.current = next.label;
    setCurrentHistoryLabel(next.label);
    showToast(`Redid "${next.label}"`, 'info');
  }, [historyFuture, images, settings, selectedLayerId, showToast]);

  const handleJumpToHistory = useCallback(
    (target: { zone: 'past' | 'future'; index: number }) => {
      const currentSnap = cloneSnapshot(
        images,
        settings,
        selectedLayerId,
        currentHistoryLabelRef.current,
        renderCanvasThumbnailDataUrl(images, settings),
      );
      const result = navigateHistoryTimeline(historyPast, currentSnap, historyFuture, target);
      if (!result) return;
      setHistoryPast(result.past);
      setHistoryFuture(result.future);
      setImages(result.current.images);
      setSettings(result.current.settings);
      setSelectedLayerId(result.current.selectedLayerId);
      setSelectedImageIds((sel) => {
        const valid = new Set(result.current.images.map((im) => im.id));
        return sel.filter((id) => valid.has(id));
      });
      currentHistoryLabelRef.current = result.current.label;
      setCurrentHistoryLabel(result.current.label);
      showToast(`Restored "${result.current.label}"`, 'info');
    },
    [historyPast, historyFuture, images, settings, selectedLayerId, showToast],
  );

  // Update Settings
  const handleUpdateSettings = useCallback(
    (patch: Partial<MergerSettings>, commitHistory = false) => {
      if (commitHistory) {
        const label = patch.layout
          ? `Layout: ${patch.layout}`
          : patch.scaleMode
            ? `Scale: ${patch.scaleMode}`
            : patch.format
              ? `Format: ${patch.format.toUpperCase()}`
              : 'Updated canvas style';
        pushHistory(images, settings, selectedLayerId, label);
      }
      setSettings((prev) => ({
        ...prev,
        ...patch,
        textStamp: patch.textStamp ? { ...patch.textStamp } : prev.textStamp,
      }));
    },
    [images, settings, selectedLayerId, pushHistory],
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (isInput) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (images.length > 0) setExportModalOpen(true);
        return;
      }

      if (isInput) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setResetViewSignal((n) => n + 1);
      } else if (e.key.toLowerCase() === 'a') {
        if (images.length > 0) {
          e.preventDefault();
          handleAutoArrangeRef.current();
        }
      } else if (e.key === '1') {
        handleUpdateSettings({ layout: 'horizontal' }, true);
      } else if (e.key === '2') {
        handleUpdateSettings({ layout: 'vertical' }, true);
      } else if (e.key === '3') {
        handleUpdateSettings({ layout: 'grid' }, true);
      } else if (e.key === '4') {
        handleUpdateSettings({ layout: 'overlay' }, true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleUpdateSettings, images.length]);

  const rotateImageClockwise90 = useCallback(
    async (target: MergerImage): Promise<MergerImage> => {
      if (!target.img) return target;
      const c = document.createElement('canvas');
      c.width = target.height;
      c.height = target.width;
      const ctx = c.getContext('2d');
      if (!ctx) return target;

      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(target.img, -target.width / 2, -target.height / 2);

      const newSrc = c.toDataURL('image/png');
      const newImg = await loadImageElementAsync(newSrc);

      let nextCrop: CropRect | undefined;
      if (target.crop) {
        const cr = target.crop;
        const rotX = clamp(target.height - (cr.y + cr.height), 0, c.width - 1);
        const rotY = clamp(cr.x, 0, c.height - 1);
        const rotW = clamp(cr.height, 1, c.width - rotX);
        const rotH = clamp(cr.width, 1, c.height - rotY);
        nextCrop = {
          ...cr,
          x: rotX,
          y: rotY,
          width: rotW,
          height: rotH,
          focalX: cr.focalY !== undefined ? Number((1 - cr.focalY).toFixed(3)) : undefined,
          focalY: cr.focalX !== undefined ? Number(cr.focalX.toFixed(3)) : undefined,
        };
      }

      return {
        ...target,
        src: newSrc,
        img: newImg,
        width: c.width,
        height: c.height,
        crop: nextCrop,
      };
    },
    [],
  );

  // Image Card Actions
  const handleRotate90 = useCallback(
    async (id: string) => {
      const target = images.find((im) => im.id === id);
      if (!target?.img) return;
      const rotated = await rotateImageClockwise90(target);
      pushHistory(images, settings, selectedLayerId, `Rotated ${target.name} 90°`);
      setImages((prev) => prev.map((im) => (im.id === id ? rotated : im)));
    },
    [images, settings, selectedLayerId, pushHistory, rotateImageClockwise90],
  );

  const handleToggleFlip = useCallback(
    (id: string, axis: 'flipH' | 'flipV') => {
      pushHistory(
        images,
        settings,
        selectedLayerId,
        axis === 'flipH' ? 'Flipped image H' : 'Flipped image V',
      );
      setImages((prev) =>
        prev.map((im) => (im.id === id ? { ...im, [axis]: !im[axis] } : im)),
      );
    },
    [images, settings, selectedLayerId, pushHistory],
  );

  const handleUpdateFilters = useCallback((id: string, filters: ImageFilters) => {
    setImages((prev) => prev.map((im) => (im.id === id ? { ...im, filters } : im)));
  }, []);

  const handleUpdateRotation = useCallback((id: string, rotation: number) => {
    setImages((prev) => prev.map((im) => (im.id === id ? { ...im, rotation } : im)));
  }, []);

  const handleApplyCrop = useCallback(
    (id: string, crop: CropRect | undefined) => {
      pushHistory(
        images,
        settings,
        selectedLayerId,
        crop ? 'Applied custom crop' : 'Reset image crop',
      );
      setImages((prev) => prev.map((im) => (im.id === id ? { ...im, crop } : im)));
      showToast(crop ? 'Applied custom crop to image' : 'Reset image crop to full frame', 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  // Batch Processing Handlers
  const handleAutoArrange = useCallback(() => {
    if (images.length === 0) return;
    const plan = computeAutoArrange(images, settings);
    pushHistory(images, settings, selectedLayerId, `Auto-arranged (${settings.layout})`);

    setSettings((prev) => ({
      ...prev,
      ...plan.settingsPatch,
      textStamp: prev.textStamp,
    }));

    if (plan.imagePatches.length > 0) {
      const patchMap = new Map(plan.imagePatches.map((p) => [p.id, p]));
      setImages((prev) =>
        prev.map((im) => {
          const p = patchMap.get(im.id);
          return p ? { ...im, ...p } : im;
        }),
      );
    }

    setResetViewSignal((n) => n + 1);
    showToast(`Auto-arranged: ${plan.summary}`, 'success');
  }, [images, settings, selectedLayerId, pushHistory, showToast]);

  const handleAutoArrangeRef = useRef(handleAutoArrange);
  handleAutoArrangeRef.current = handleAutoArrange;

  const handleSmartAlign = useCallback(
    (mode: SmartAlignmentMode) => {
      if (images.length === 0) return;
      const inputs = images.map((im) => ({
        id: im.id,
        width: im.width,
        height: im.height,
        crop: im.crop,
        opacity: im.opacity,
        signal: im.img
          ? detectContentSignal(im.img, im.crop)
          : {
              focalX: 0.5,
              focalY: 0.5,
              contentBounds: { left: 0, top: 0, right: 1, bottom: 1 },
              edgeDensity: 10,
            },
      }));

      const plan = computeSmartAlignment(inputs, settings.layout, mode);
      pushHistory(images, settings, selectedLayerId, `Smart Align (${mode})`);

      setSettings((prev) => ({
        ...prev,
        ...plan.settingsPatch,
        textStamp: prev.textStamp,
      }));

      if (plan.imagePatches.length > 0) {
        const patchMap = new Map(plan.imagePatches.map((p) => [p.id, p]));
        setImages((prev) =>
          prev.map((im) => {
            const p = patchMap.get(im.id);
            return p ? { ...im, ...p } : im;
          }),
        );
      }

      setResetViewSignal((n) => n + 1);
      showToast(`Smart Alignment: ${plan.summary}`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleBatchRename = useCallback(
    (options: BatchRenameOptions) => {
      if (images.length === 0) return;
      const renamed = generateBatchRenamedNames(images, options);
      const nameMap = new Map(renamed.map((r) => [r.id, r.newName]));
      pushHistory(images, settings, selectedLayerId, `Batch renamed ${renamed.length} files`);
      setImages((prev) =>
        prev.map((im) => ({
          ...im,
          name: nameMap.get(im.id) ?? im.name,
        })),
      );
      showToast(`Renamed ${renamed.length} images`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleRenameSingleImage = useCallback(
    (id: string, nextName: string) => {
      const clean = nextName.trim();
      if (!clean) return;
      pushHistory(images, settings, selectedLayerId, `Renamed file to ${clean}`);
      setImages((prev) => prev.map((im) => (im.id === id ? { ...im, name: clean } : im)));
      showToast(`Renamed image to ${clean}`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleSortImages = useCallback(
    (mode: 'name-asc' | 'reverse') => {
      if (images.length < 2) return;
      pushHistory(
        images,
        settings,
        selectedLayerId,
        mode === 'name-asc' ? 'Sorted images A–Z' : 'Reversed image order',
      );
      setImages((prev) => {
        const copy = [...prev];
        if (mode === 'name-asc') {
          copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        } else {
          copy.reverse();
        }
        return copy;
      });
      showToast(mode === 'name-asc' ? 'Sorted images A–Z' : 'Reversed image order', 'info');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleToggleSelectImage = useCallback((id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAllImages = useCallback(() => {
    setSelectedImageIds(images.map((im) => im.id));
  }, [images]);

  const handleClearSelection = useCallback(() => {
    setSelectedImageIds([]);
  }, []);

  const handleBatchApplyFilters = useCallback(
    (filters: ImageFilters) => {
      if (images.length === 0) return;
      const scopedCount =
        selectedImageIds.length > 0
          ? images.filter((im) => selectedImageIds.includes(im.id)).length
          : images.length;
      const scopeLabel =
        selectedImageIds.length > 0 && scopedCount > 0
          ? `${scopedCount} selected`
          : `all ${images.length}`;
      pushHistory(images, settings, selectedLayerId, `Applied batch filters (${scopeLabel})`);
      setImages((prev) => applyBatchColorAdjustments(prev, selectedImageIds, filters));
      showToast(`Applied color preset to ${scopeLabel} images`, 'success');
    },
    [images, selectedImageIds, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleBatchColorAdjust = useCallback(
    (patch: Partial<ImageFilters>) => {
      if (images.length === 0) return;
      const scopedCount =
        selectedImageIds.length > 0
          ? images.filter((im) => selectedImageIds.includes(im.id)).length
          : 0;
      const label =
        scopedCount > 0 ? `Batch color (${scopedCount} selected)` : 'Batch color (all)';

      if (rangePointerCommittedRef.current) {
        currentHistoryLabelRef.current = label;
        setCurrentHistoryLabel(label);
      } else if (Date.now() - lastColorCommitRef.current > 600) {
        pushHistory(images, settings, selectedLayerId, label);
        lastColorCommitRef.current = Date.now();
      } else {
        currentHistoryLabelRef.current = label;
        setCurrentHistoryLabel(label);
      }

      setImages((prev) => applyBatchColorAdjustments(prev, selectedImageIds, patch));
    },
    [images, selectedImageIds, settings, selectedLayerId, pushHistory],
  );

  const handleBatchSharpen = useCallback(
    (strength: number) => {
      if (images.length === 0) return;
      const safe = clamp(Math.round(strength), 0, 100);
      const label = `Batch sharpen ${safe}%`;
      if (rangePointerCommittedRef.current) {
        currentHistoryLabelRef.current = label;
        setCurrentHistoryLabel(label);
      } else if (Date.now() - lastSharpenCommitRef.current > 600) {
        pushHistory(images, settings, selectedLayerId, label);
        lastSharpenCommitRef.current = Date.now();
      } else {
        currentHistoryLabelRef.current = label;
        setCurrentHistoryLabel(label);
      }
      setImages((prev) => applyBatchColorAdjustments(prev, selectedImageIds, { sharpen: safe }));
    },
    [images, selectedImageIds, settings, selectedLayerId, pushHistory],
  );

  const handleBatchResize = useCallback(
    async (mode: BatchResizeMode, value: number) => {
      if (images.length === 0) return;
      setBatchBusy(true);
      try {
        const snapshot = cloneSnapshot(
          images,
          settings,
          selectedLayerId,
          currentHistoryLabelRef.current,
          renderCanvasThumbnailDataUrl(images, settings),
        );
        const resized = await Promise.all(
          images.map((im) => {
            const target = computeBatchResizeDimensions(im.width, im.height, mode, value);
            return resizeImageElementAsync(im, target.width, target.height);
          }),
        );
        setHistoryPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
        setHistoryFuture([]);
        const nextLabel = `Batch resize (${mode})`;
        currentHistoryLabelRef.current = nextLabel;
        setCurrentHistoryLabel(nextLabel);
        setImages(resized);
        showToast(`Resized all ${resized.length} images (${mode})`, 'success');
      } catch {
        showToast('Failed to resize images in batch.', 'error');
      } finally {
        setBatchBusy(false);
      }
    },
    [images, settings, selectedLayerId, showToast],
  );

  const handleBatchWatermark = useCallback(
    async (options: BatchWatermarkOptions) => {
      if (images.length === 0 || !options.text.trim()) return;
      setBatchBusy(true);
      try {
        const snapshot = cloneSnapshot(
          images,
          settings,
          selectedLayerId,
          currentHistoryLabelRef.current,
          renderCanvasThumbnailDataUrl(images, settings),
        );
        const stamped = await Promise.all(
          images.map((im) => watermarkImageElementAsync(im, options)),
        );
        setHistoryPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
        setHistoryFuture([]);
        const nextLabel = 'Batch watermarked images';
        currentHistoryLabelRef.current = nextLabel;
        setCurrentHistoryLabel(nextLabel);
        setImages(stamped);
        showToast(`Stamped watermark across ${stamped.length} images`, 'success');
      } catch {
        showToast('Failed to watermark images in batch.', 'error');
      } finally {
        setBatchBusy(false);
      }
    },
    [images, settings, selectedLayerId, showToast],
  );

  const handleBatchCropAspect = useCallback(
    (preset: CropAspectPreset | 'reset') => {
      if (images.length === 0) return;
      pushHistory(
        images,
        settings,
        selectedLayerId,
        preset === 'reset' ? 'Cleared batch crops' : `Batch focal crop (${preset})`,
      );
      if (preset === 'reset') {
        setImages((prev) => prev.map((im) => ({ ...im, crop: undefined })));
        showToast('Cleared crops across all images', 'info');
        return;
      }
      const ratio = CROP_ASPECT_RATIOS[preset];
      setImages((prev) =>
        prev.map((im) => {
          const focal = im.img ? detectSmartFocalPoint(im.img) : { focalX: 0.5, focalY: 0.5 };
          return {
            ...im,
            crop: computeAspectCropRect(
              im.width,
              im.height,
              ratio,
              focal.focalX,
              focal.focalY,
              preset,
            ),
          };
        }),
      );
      showToast(`Applied smart ${preset} focal crop to ${images.length} images`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleBatchTransform = useCallback(
    async (action: 'rotate90' | 'flipH' | 'flipV') => {
      if (images.length === 0) return;
      if (action === 'flipH' || action === 'flipV') {
        pushHistory(
          images,
          settings,
          selectedLayerId,
          action === 'flipH' ? 'Batch flip horizontal' : 'Batch flip vertical',
        );
        setImages((prev) => prev.map((im) => ({ ...im, [action]: !im[action] })));
        showToast(
          action === 'flipH' ? 'Flipped all images horizontally' : 'Flipped all images vertically',
          'success',
        );
        return;
      }

      setBatchBusy(true);
      try {
        const snapshot = cloneSnapshot(
          images,
          settings,
          selectedLayerId,
          currentHistoryLabelRef.current,
          renderCanvasThumbnailDataUrl(images, settings),
        );
        const rotated = await Promise.all(images.map((im) => rotateImageClockwise90(im)));
        setHistoryPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
        setHistoryFuture([]);
        const nextLabel = 'Batch rotate 90°';
        currentHistoryLabelRef.current = nextLabel;
        setCurrentHistoryLabel(nextLabel);
        setImages(rotated);
        showToast(`Rotated all ${rotated.length} images 90°`, 'success');
      } catch {
        showToast('Failed to rotate images in batch.', 'error');
      } finally {
        setBatchBusy(false);
      }
    },
    [images, settings, selectedLayerId, pushHistory, rotateImageClockwise90, showToast],
  );

  const handleReorder = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      pushHistory(images, settings, selectedLayerId, 'Reordered images');
      setImages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    },
    [images, settings, selectedLayerId, pushHistory],
  );

  const handleMoveEdge = useCallback(
    (id: string, edge: 'first' | 'last') => {
      const idx = images.findIndex((im) => im.id === id);
      if (idx < 0) return;
      handleReorder(idx, edge === 'first' ? 0 : images.length - 1);
    },
    [images, handleReorder],
  );

  const handleDeleteImage = useCallback(
    (id: string) => {
      pushHistory(images, settings, selectedLayerId, 'Removed image');
      setImages((prev) => {
        const next = prev.filter((im) => im.id !== id);
        if (selectedLayerId === id) {
          setSelectedLayerId(next[0]?.id ?? null);
        }
        return next;
      });
      setSelectedImageIds((prev) => prev.filter((item) => item !== id));
      showToast('Image removed', 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  // Overlay layer transforms & stacking
  const handleUpdateLayerTransform = useCallback(
    (
      id: string,
      patch: Partial<Pick<MergerImage, 'x' | 'y' | 'scale' | 'rotation' | 'opacity'>>,
      commitHistory = false,
    ) => {
      if (commitHistory) {
        pushHistory(images, settings, selectedLayerId, 'Adjusted layer transform');
      }
      setImages((prev) => prev.map((im) => (im.id === id ? { ...im, ...patch } : im)));
    },
    [images, settings, selectedLayerId, pushHistory],
  );

  const handleDragOverlayLayer = useCallback((id: string, x: number, y: number) => {
    setImages((prev) => prev.map((im) => (im.id === id ? { ...im, x, y } : im)));
  }, []);

  const handleNudgeOverlayLayer = useCallback(
    (dx: number, dy: number) => {
      const targetId = selectedLayerId ?? images[images.length - 1]?.id;
      if (!targetId) return;
      pushHistory(images, settings, selectedLayerId, 'Nudged layer position');
      setImages((prev) =>
        prev.map((im) => (im.id === targetId ? { ...im, x: im.x + dx, y: im.y + dy } : im)),
      );
    },
    [images, settings, selectedLayerId, pushHistory],
  );

  const handleMoveLayerOrder = useCallback(
    (id: string, direction: 'forward' | 'back' | 'front' | 'toBack') => {
      const idx = images.findIndex((im) => im.id === id);
      if (idx < 0 || images.length < 2) return;
      let targetIdx = idx;
      if (direction === 'forward') targetIdx = Math.min(images.length - 1, idx + 1);
      else if (direction === 'back') targetIdx = Math.max(0, idx - 1);
      else if (direction === 'front') targetIdx = images.length - 1;
      else if (direction === 'toBack') targetIdx = 0;

      if (targetIdx !== idx) {
        handleReorder(idx, targetIdx);
      }
    },
    [images, handleReorder],
  );

  // Quick-Start Template Loader
  const handleLoadTemplate = useCallback(
    async (spec: SampleTemplateSpec) => {
      try {
        const built = await spec.buildImages();
        pushHistory(images, settings, selectedLayerId, `Loaded "${spec.title}"`);
        setImages(built);
        setSelectedImageIds([]);
        setSelectedLayerId(built[built.length - 1]?.id ?? null);
        setSettings((prev) => ({
          ...prev,
          ...DEFAULT_SETTINGS,
          ...spec.recommendedSettings,
          textStamp: { ...DEFAULT_SETTINGS.textStamp },
        }));
        showToast(`Loaded "${spec.title}" sample workflow`, 'success');
      } catch {
        showToast('Unable to generate sample workflow.', 'error');
      }
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  // Presets
  const handleSavePreset = useCallback(
    (name: string) => {
      const nextPreset: UserPreset = {
        id: `preset-${Date.now()}`,
        name,
        createdAt: Date.now(),
        settings: { ...settings, textStamp: { ...settings.textStamp } },
      };
      const updated = [nextPreset, ...userPresets];
      setUserPresets(updated);
      saveUserPresets(updated);
      showToast(`Saved preset "${name}"`, 'success');
    },
    [settings, userPresets, showToast],
  );

  const handleApplyPreset = useCallback(
    (preset: UserPreset) => {
      pushHistory(images, settings, selectedLayerId, `Preset: ${preset.name}`);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...preset.settings,
        textStamp: { ...DEFAULT_TEXT_STAMP_SAFE(preset.settings) },
      });
      showToast(`Applied preset "${preset.name}"`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleDeletePreset = useCallback(
    (id: string) => {
      const updated = userPresets.filter((p) => p.id !== id);
      setUserPresets(updated);
      saveUserPresets(updated);
      showToast('Preset deleted', 'info');
    },
    [userPresets, showToast],
  );

  // Export Presets & Dimensions
  const handleUpdateExportDimensions = useCallback((patch: Partial<ExportDimensionsConfig>) => {
    setExportDimensions((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveExportPreset = useCallback(
    (presetData: Omit<ExportPreset, 'id' | 'createdAt'>) => {
      const next: ExportPreset = {
        ...presetData,
        id: `exp-preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      };
      const updated = [next, ...exportPresets];
      setExportPresets(updated);
      saveExportPresets(updated);
      showToast(`Saved export preset "${next.name}"`, 'success');
    },
    [exportPresets, showToast],
  );

  const handleApplyExportPreset = useCallback(
    (preset: ExportPreset) => {
      pushHistory(images, settings, selectedLayerId, `Export preset: ${preset.name}`);
      setSettings((prev) => ({
        ...prev,
        format: preset.format,
        quality: preset.quality,
        transparentBg: preset.format === 'jpeg' ? false : preset.transparentBg,
        filenamePrefix: preset.filenamePrefix?.trim()
          ? preset.filenamePrefix
          : prev.filenamePrefix,
      }));
      setExportDimensions({
        dimensionMode: preset.dimensionMode,
        maxWidth: preset.maxWidth,
        maxHeight: preset.maxHeight,
        customScale: preset.customScale,
      });
      showToast(`Applied export preset "${preset.name}"`, 'success');
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  const handleDeleteExportPreset = useCallback(
    (id: string) => {
      const updated = exportPresets.filter((p) => p.id !== id);
      setExportPresets(updated);
      saveExportPresets(updated);
      showToast('Export preset deleted', 'info');
    },
    [exportPresets, showToast],
  );

  // Save & Load Workspace Project (.json)
  const handleSaveProject = useCallback(() => {
    if (images.length === 0) return;
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      settings,
      images: images.map(({ img: _img, ...serializable }) => serializable),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const filename = `${sanitizeFilename(settings.filenamePrefix)}-project.json`;
    triggerBlobDownload(blob, filename);
    showToast(`Saved project as ${filename}`, 'success');
  }, [images, settings, showToast]);

  const handleLoadProjectFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.images) || !parsed.settings) {
          throw new Error('Invalid project structure');
        }
        const hydrated: MergerImage[] = [];
        for (const item of parsed.images.slice(0, MAX_IMAGES)) {
          if (typeof item.src === 'string') {
            const imgEl = await loadImageFromSrc(item.src);
            const origW = item.originalWidth ?? item.width ?? (imgEl.naturalWidth || imgEl.width);
            const origH = item.originalHeight ?? item.height ?? (imgEl.naturalHeight || imgEl.height);
            const metadata =
              item.metadata ??
              extractMetadataFromDataUrl(item.src, {
                fileName: item.name,
                fileSize: item.size,
                width: origW,
                height: origH,
              });
            hydrated.push({
              ...item,
              img: imgEl,
              originalWidth: origW,
              originalHeight: origH,
              metadata,
              filters: { ...DEFAULT_FILTERS, ...(item.filters || {}) },
            });
          }
        }
        pushHistory(images, settings, selectedLayerId, `Opened project (${hydrated.length} img)`);
        setImages(hydrated);
        setSelectedImageIds([]);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          textStamp: { ...DEFAULT_SETTINGS.textStamp, ...(parsed.settings.textStamp || {}) },
        });
        setSelectedLayerId(hydrated[0]?.id ?? null);
        showToast(`Loaded project (${hydrated.length} images)`, 'success');
      } catch {
        showToast('Could not open project file — invalid or corrupted JSON.', 'error');
      }
    },
    [images, settings, selectedLayerId, pushHistory, showToast],
  );

  // Offscreen clean export helper (omits overlay dashed selection box and honors ExportDimensions)
  const renderExportCanvas = useCallback(
    (forceOpaqueWhiteForPdf = false): HTMLCanvasElement => {
      const offscreen = document.createElement('canvas');
      const exportSettings = forceOpaqueWhiteForPdf
        ? { ...settings, transparentBg: false, format: 'jpeg' as const }
        : settings;
      renderMergedCanvas(offscreen, images, exportSettings, { showSelectionHighlight: false });
      const target = computeExportDimensions(offscreen.width, offscreen.height, exportDimensions);
      if (target.scaled && target.width > 0 && target.height > 0) {
        return scaleCanvasToDimensions(offscreen, target.width, target.height);
      }
      return offscreen;
    },
    [images, settings, exportDimensions],
  );

  const handleDownloadStandard = useCallback(async () => {
    const offscreen = renderExportCanvas(false);
    if (!offscreen.width || !offscreen.height) return;
    const blob = await canvasToBlobAsync(offscreen, settings.format, settings.quality);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `${sanitizeFilename(settings.filenamePrefix)}-${stamp}.${settings.format}`;
    triggerBlobDownload(blob, filename);
    setTelemetry(recordExportTelemetry(images.length));
    showToast(`Downloaded ${filename} (${formatBytes(blob.size)})`, 'success');
  }, [renderExportCanvas, settings, images.length, showToast]);

  const handleDownloadBatchZip = useCallback(async () => {
    if (images.length === 0) return;
    const entries: Array<{ name: string; data: Uint8Array }> = [];
    const seen = new Map<string, number>();

    for (const im of images) {
      const blob = await renderProcessedImageBlobAsync(
        im,
        settings.format,
        settings.quality,
        settings.transparentBg,
        settings.bgColor,
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dot = im.name.lastIndexOf('.');
      const stem = (dot > 0 ? im.name.slice(0, dot) : im.name)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        .trim() || 'image';
      let outName = `${stem}.${settings.format}`;
      const lower = outName.toLowerCase();
      const dupCount = seen.get(lower) ?? 0;
      seen.set(lower, dupCount + 1);
      if (dupCount > 0) {
        outName = `${stem}-${dupCount + 1}.${settings.format}`;
      }
      entries.push({ name: outName, data: bytes });
    }

    const zipBytes = buildZipArchive(entries);
    const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const zipFilename = `${sanitizeFilename(settings.filenamePrefix)}-batch-${stamp}.zip`;
    triggerBlobDownload(zipBlob, zipFilename);
    setTelemetry(recordExportTelemetry(images.length));
    showToast(`Downloaded ${zipFilename} (${entries.length} files, ${formatBytes(zipBlob.size)})`, 'success');
  }, [images, settings.format, settings.quality, settings.transparentBg, settings.bgColor, settings.filenamePrefix, showToast]);

  const handleDownloadTargetKb = useCallback(
    async (targetKb: number, format: 'jpeg' | 'webp'): Promise<string> => {
      const offscreen = renderExportCanvas(format === 'jpeg');
      const res = await optimizeCanvasToTargetSize(offscreen, format, targetKb);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const filename = `${sanitizeFilename(settings.filenamePrefix)}-max${targetKb}kb-${stamp}.${format}`;
      triggerBlobDownload(res.blob, filename);
      setTelemetry(recordExportTelemetry(images.length));
      const summary = res.reachedTarget
        ? `Achieved ${formatBytes(res.blob.size)} at ${res.qualityPct}% quality (${res.scalePct}% scale).`
        : `Smallest achievable size was ${formatBytes(res.blob.size)} at 10% quality.`;
      showToast(`Downloaded ${filename}`, 'success');
      return summary;
    },
    [renderExportCanvas, settings.filenamePrefix, images.length, showToast],
  );

  const handleDownloadPdf = useCallback(async () => {
    const offscreen = renderExportCanvas(true);
    if (!offscreen.width || !offscreen.height) return;
    const jpegBlob = await canvasToBlobAsync(offscreen, 'jpeg', 92);
    const buf = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdfBytes = buildPdfFromJpegBytes(buf, offscreen.width, offscreen.height, 150);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `${sanitizeFilename(settings.filenamePrefix)}-${stamp}.pdf`;
    triggerBlobDownload(pdfBlob, filename);
    setTelemetry(recordExportTelemetry(images.length));
    showToast(`Exported print-ready ${filename}`, 'success');
  }, [renderExportCanvas, settings.filenamePrefix, images.length, showToast]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      const offscreen = renderExportCanvas(false);
      const pngBlob = await canvasToBlobAsync(offscreen, 'png', 100);
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image API unavailable');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      showToast('Copied merged PNG to clipboard', 'success');
    } catch {
      showToast('Browser blocked direct clipboard write — use Download instead.', 'warning');
    }
  }, [renderExportCanvas, showToast]);

  const handleResetSettings = useCallback(() => {
    pushHistory(images, settings, selectedLayerId, 'Reset canvas settings');
    setSettings({
      ...DEFAULT_SETTINGS,
      textStamp: { ...DEFAULT_SETTINGS.textStamp },
    });
    showToast('Settings reset to defaults', 'info');
  }, [images, settings, selectedLayerId, pushHistory, showToast]);

  const handleConfirmClearAll = useCallback(() => {
    pushHistory(images, settings, selectedLayerId, 'Cleared all images');
    setImages([]);
    setSelectedImageIds([]);
    setSelectedLayerId(null);
    setClearConfirmOpen(false);
    showToast('Cleared all images', 'success');
  }, [images, settings, selectedLayerId, pushHistory, showToast]);

  return (
    <div id="studio-top" className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to studio workspace
      </a>

      <HeaderBar
        imageCount={images.length}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenExport={() => setExportModalOpen(true)}
      />

      <main
        id="main-workspace"
        className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5"
      >
        <WorkspaceToolbar
          imageCount={images.length}
          totalInputBytes={totalInputBytes}
          outputStats={outputStats}
          formatLabel={settings.format}
          canUndo={historyPast.length > 0}
          canRedo={historyFuture.length > 0}
          historyPast={historyPast}
          historyFuture={historyFuture}
          currentHistoryLabel={currentHistoryLabel}
          currentThumbnail={currentThumbnail}
          theme={theme}
          telemetry={telemetry}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onJumpToHistory={handleJumpToHistory}
          onPasteClipboard={handlePasteFromClipboardButton}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onSaveProject={handleSaveProject}
          onLoadProjectFile={handleLoadProjectFile}
          onResetSettings={handleResetSettings}
          onRequestClearAll={() => setClearConfirmOpen(true)}
        />

        {/* Hidden shared file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              ingestFiles(e.target.files);
            }
            e.target.value = '';
          }}
          className="hidden"
          aria-hidden="true"
        />

        {/* Studio Grid: Mobile shows Live Canvas first, Desktop places Left Inspector + Right Viewport */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div
            className="order-2 lg:order-1"
            onPointerDown={(e) => {
              if ((e.target as HTMLInputElement)?.type === 'range') {
                rangePointerCommittedRef.current = true;
                pushHistory(images, settings, selectedLayerId, 'Adjusted slider setting');
              }
            }}
          >
            <ControlSidebar
              images={images}
              selectedImageIds={selectedImageIds}
              settings={settings}
              userPresets={userPresets}
              imageCount={images.length}
              batchBusy={batchBusy}
              onSelectAllImages={handleSelectAllImages}
              onClearSelection={handleClearSelection}
              onAutoArrange={handleAutoArrange}
              onSmartAlign={handleSmartAlign}
              onUpdateSettings={handleUpdateSettings}
              onSavePreset={handleSavePreset}
              onApplyPreset={handleApplyPreset}
              onDeletePreset={handleDeletePreset}
              onBatchRename={handleBatchRename}
              onBatchApplyFilters={handleBatchApplyFilters}
              onBatchColorAdjust={handleBatchColorAdjust}
              onBatchSharpen={handleBatchSharpen}
              onBatchResize={handleBatchResize}
              onBatchWatermark={handleBatchWatermark}
              onBatchCropAspect={handleBatchCropAspect}
              onBatchTransform={handleBatchTransform}
            />
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
            <PreviewViewport
              canvasRef={previewCanvasRef}
              images={images}
              settings={settings}
              outputStats={outputStats}
              selectedLayerId={selectedLayerId}
              backdrop={backdrop}
              resetViewSignal={resetViewSignal}
              onChangeBackdrop={setBackdrop}
              onBrowseFiles={() => fileInputRef.current?.click()}
              onDropFiles={ingestFiles}
              onPasteClipboard={handlePasteFromClipboardButton}
              onLoadTemplate={handleLoadTemplate}
              onSelectLayer={setSelectedLayerId}
              onStartOverlayDrag={() =>
                pushHistory(images, settings, selectedLayerId, 'Moved overlay layer')
              }
              onDragOverlayLayer={handleDragOverlayLayer}
              onNudgeOverlayLayer={handleNudgeOverlayLayer}
              onAutoArrange={handleAutoArrange}
            />

            {settings.layout === 'overlay' && (
              <div
                onPointerDown={(e) => {
                  if ((e.target as HTMLInputElement)?.type === 'range') {
                    rangePointerCommittedRef.current = true;
                    pushHistory(images, settings, selectedLayerId, 'Adjusted layer transform');
                  }
                }}
              >
                <LayerPanel
                  images={images}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onUpdateLayerTransform={handleUpdateLayerTransform}
                  onMoveLayerOrder={handleMoveLayerOrder}
                />
              </div>
            )}

            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLInputElement)?.type === 'range') {
                  rangePointerCommittedRef.current = true;
                  pushHistory(images, settings, selectedLayerId, 'Adjusted image FX');
                }
              }}
            >
              <ImageTray
                images={images}
                selectedImageIds={selectedImageIds}
                onToggleSelectImage={handleToggleSelectImage}
                onSelectAllImages={handleSelectAllImages}
                onClearSelection={handleClearSelection}
                onBrowseFiles={() => fileInputRef.current?.click()}
                onDropFiles={ingestFiles}
                onReorder={handleReorder}
                onSortImages={handleSortImages}
                onRenameImage={handleRenameSingleImage}
                onOpenCrop={(id) => setCropTargetId(id)}
                onRotate90={handleRotate90}
                onUpdateRotation={handleUpdateRotation}
                onToggleFlip={handleToggleFlip}
                onUpdateFilters={handleUpdateFilters}
                onMoveEdge={handleMoveEdge}
                onDelete={handleDeleteImage}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-surface px-6 py-4 text-xs text-muted">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <span>
            Image Merger Pro · Client-side HTML5 Canvas engine (images never leave your device)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="cursor-pointer hover:text-foreground hover:underline"
            >
              Keyboard Shortcuts
            </button>
            <a
              href="https://github.com/oathanrex"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground hover:underline"
            >
              GitHub · oathanrex
            </a>
          </div>
        </div>
      </footer>

      <ExportModal
        open={exportModalOpen}
        images={images}
        settings={settings}
        outputStats={outputStats}
        exportDimensions={exportDimensions}
        exportPresets={exportPresets}
        onClose={() => setExportModalOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onUpdateExportDimensions={handleUpdateExportDimensions}
        onSaveExportPreset={handleSaveExportPreset}
        onApplyExportPreset={handleApplyExportPreset}
        onDeleteExportPreset={handleDeleteExportPreset}
        onDownloadStandard={handleDownloadStandard}
        onDownloadBatchZip={handleDownloadBatchZip}
        onDownloadTargetKb={handleDownloadTargetKb}
        onDownloadPdf={handleDownloadPdf}
        onCopyToClipboard={handleCopyToClipboard}
      />

      <ConfirmModal
        open={clearConfirmOpen}
        title="Clear all uploaded images?"
        description="This will remove all current source images from the canvas workspace. You can still restore them immediately using Undo."
        confirmLabel="Clear All"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <CropModal
        image={images.find((im) => im.id === cropTargetId) ?? null}
        onClose={() => setCropTargetId(null)}
        onApplyCrop={handleApplyCrop}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function DEFAULT_TEXT_STAMP_SAFE(s: Partial<MergerSettings>) {
  return {
    ...DEFAULT_SETTINGS.textStamp,
    ...(s.textStamp || {}),
  };
}
