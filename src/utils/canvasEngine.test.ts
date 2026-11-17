import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROP_ASPECT_RATIOS,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  MAX_CANVAS_SIZE,
  applyBatchColorAdjustments,
  buildCssFilterString,
  buildPdfFromJpegBytes,
  buildZipArchive,
  calcCanvasLayout,
  calcPrintSizeInches,
  computeAspectCropRect,
  computeAutoArrange,
  computeBatchResizeDimensions,
  computeExportDimensions,
  computeFitZoomScale,
  computeSmartAlignment,
  convolveSharpenImageData,
  formatAspectRatio,
  formatBytes,
  generateBatchRenamedNames,
  getEffectiveImageDimensions,
  navigateHistoryTimeline,
  sanitizeFilename,
} from './canvasEngine';

test('calcCanvasLayout returns zero dimensions for empty input', () => {
  const res = calcCanvasLayout([], DEFAULT_SETTINGS);
  assert.equal(res.width, 0);
  assert.equal(res.height, 0);
  assert.equal(res.items.length, 0);
});

test('calcCanvasLayout horizontal same-height scales taller image down cleanly', () => {
  const imgs = [
    { id: 'a', width: 400, height: 200 },
    { id: 'b', width: 800, height: 400 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'horizontal',
    scaleMode: 'same-height',
    spacing: 20,
    padding: 10,
    borderWidth: 0,
  });

  assert.equal(res.width, 400 + 400 + 20 + 20);
  assert.equal(res.height, 200 + 20);
  assert.equal(res.items.length, 2);
  assert.equal(res.items[0].w, 400);
  assert.equal(res.items[1].w, 400);
});

test('calcCanvasLayout uses effective cropped dimensions when crop is present', () => {
  const imgs = [
    {
      id: 'a',
      width: 1000,
      height: 800,
      crop: { x: 100, y: 100, width: 400, height: 400 },
    },
    { id: 'b', width: 400, height: 400 },
  ];
  const eff = getEffectiveImageDimensions(imgs[0]);
  assert.equal(eff.width, 400);
  assert.equal(eff.height, 400);

  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'horizontal',
    scaleMode: 'original',
    spacing: 10,
    padding: 0,
    borderWidth: 0,
  });
  assert.equal(res.width, 810);
  assert.equal(res.height, 400);
});

test('computeAspectCropRect centers and clamps focal region inside image bounds', () => {
  const sq = computeAspectCropRect(800, 400, CROP_ASPECT_RATIOS['1:1'], 0.95, 0.5, '1:1');
  assert.equal(sq.width, 400);
  assert.equal(sq.height, 400);
  // Clamped to right edge (800 - 400)
  assert.equal(sq.x, 400);
  assert.equal(sq.y, 0);

  const wide = computeAspectCropRect(800, 800, CROP_ASPECT_RATIOS['16:9'], 0.5, 0.2, '16:9');
  assert.equal(wide.width, 800);
  assert.equal(wide.height, 450);
  assert.equal(wide.x, 0);
  assert.equal(wide.y, 0); // 0.2 * 800 - 225 = -65 -> clamped to 0
});

test('computeBatchResizeDimensions handles max-edge, width, height, and percent modes', () => {
  assert.deepEqual(computeBatchResizeDimensions(1600, 800, 'max-edge', 800), {
    width: 800,
    height: 400,
  });
  assert.deepEqual(computeBatchResizeDimensions(600, 400, 'max-edge', 1200), {
    width: 600,
    height: 400,
  });
  assert.deepEqual(computeBatchResizeDimensions(800, 400, 'width', 400), {
    width: 400,
    height: 200,
  });
  assert.deepEqual(computeBatchResizeDimensions(800, 400, 'height', 600), {
    width: 1200,
    height: 600,
  });
  assert.deepEqual(computeBatchResizeDimensions(500, 300, 'percent', 50), {
    width: 250,
    height: 150,
  });
});

test('calcCanvasLayout vertical original alignment positions items accurately', () => {
  const imgs = [
    { id: 'a', width: 300, height: 100 },
    { id: 'b', width: 500, height: 150 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'vertical',
    scaleMode: 'original',
    spacing: 10,
    padding: 0,
    alignment: 'center',
    borderWidth: 2,
  });

  assert.equal(res.width, 504);
  assert.equal(res.height, 268);
  assert.equal(res.items[0].cx, 252);
  assert.equal(res.items[1].cx, 252);
});

test('calcCanvasLayout grid autoColumns computes ceil(sqrt(N)) columns', () => {
  const imgs = [
    { id: '1', width: 200, height: 200 },
    { id: '2', width: 200, height: 200 },
    { id: '3', width: 200, height: 200 },
    { id: '4', width: 200, height: 200 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'grid',
    autoColumns: true,
    scaleMode: 'original',
    spacing: 16,
    padding: 0,
    borderWidth: 0,
  });

  assert.equal(res.width, 416);
  assert.equal(res.height, 416);
});

test('calcCanvasLayout overlay respects rotation and off-center coordinates without clipping', () => {
  const imgs = [
    { id: '1', width: 400, height: 200, x: 350, y: 0, scale: 100, rotation: 90 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'overlay',
    padding: 0,
    borderWidth: 0,
  });

  assert.equal(res.width, 900);
  assert.equal(res.height, 600);
  assert.equal(res.items[0].cx, 450 + 350);
  assert.equal(res.items[0].cy, 300);
});

test('calcCanvasLayout caps oversized canvas proportionally to MAX_CANVAS_SIZE', () => {
  const imgs = [
    { id: '1', width: 6000, height: 1000 },
    { id: '2', width: 6000, height: 1000 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'horizontal',
    scaleMode: 'original',
    spacing: 0,
    padding: 0,
    borderWidth: 0,
  });

  assert.equal(res.wasCapped, true);
  assert.equal(res.rawWidth, 12000);
  assert.equal(res.width, MAX_CANVAS_SIZE);
  assert.ok(res.scaleFactor < 1);
});

test('buildPdfFromJpegBytes generates valid PDF 1.4 header, DCTDecode object, and EOF trailer', () => {
  const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdf = buildPdfFromJpegBytes(dummyJpeg, 600, 300, 150);
  const text = new TextDecoder('latin1').decode(pdf);

  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.includes('/Subtype /Image'));
  assert.ok(text.includes('/Width 600 /Height 300'));
  assert.ok(text.includes('/Filter /DCTDecode'));
  assert.ok(text.endsWith('%%EOF\n'));
});

test('utility formatters handle bytes, ratios, print dimensions, filters, and filenames', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatAspectRatio(1920, 1080), '16:9');
  assert.equal(calcPrintSizeInches(900, 600, 300), '3.0 × 2.0 in');
  assert.equal(sanitizeFilename('  bad<name>"test.png  '), 'badnametest.png');
  assert.equal(buildCssFilterString({ brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: false }), 'none');
  assert.equal(
    buildCssFilterString({ brightness: 110, contrast: 105, saturation: 90, hue: 45, grayscale: true }),
    'brightness(110%) contrast(105%) saturate(90%) hue-rotate(45deg) grayscale(100%)',
  );
});

test('calcCanvasLayout expands bounding box for arbitrary 0-360 rotation in horizontal layout', () => {
  const imgs = [
    { id: '1', width: 200, height: 200, rotation: 45 },
    { id: '2', width: 200, height: 200, rotation: 315 },
  ];
  const res = calcCanvasLayout(imgs, {
    ...DEFAULT_SETTINGS,
    layout: 'horizontal',
    scaleMode: 'original',
    spacing: 10,
    padding: 0,
    borderWidth: 0,
  });
  // 200x200 rotated 45 deg -> ceil(200 * sqrt(2)) = 283
  assert.equal(res.items[0].rotationDeg, 45);
  assert.equal(res.items[1].rotationDeg, 315);
  assert.equal(res.height, 283);
  assert.equal(res.width, 283 + 283 + 10);
});

test('computeFitZoomScale scales oversized canvases to viewport while capping at 1.0', () => {
  assert.equal(computeFitZoomScale(2400, 1200, 848, 548, 48), 0.333);
  assert.equal(computeFitZoomScale(400, 300, 1000, 600, 48), 1);
  assert.equal(computeFitZoomScale(0, 0, 1000, 600, 48), 1);
});

test('computeAutoArrange calculates optimal spacing and scaling for horizontal, vertical, grid, and overlay', () => {
  const mixed = [
    { id: '1', width: 1200, height: 800 },
    { id: '2', width: 600, height: 400 },
    { id: '3', width: 900, height: 600 },
  ];

  const horiz = computeAutoArrange(mixed, { ...DEFAULT_SETTINGS, layout: 'horizontal' });
  assert.equal(horiz.settingsPatch.scaleMode, 'same-height');
  assert.equal(horiz.settingsPatch.alignment, 'center');
  assert.ok((horiz.settingsPatch.spacing ?? 0) >= 8);

  const vert = computeAutoArrange(mixed, { ...DEFAULT_SETTINGS, layout: 'vertical' });
  assert.equal(vert.settingsPatch.scaleMode, 'same-width');
  assert.equal(vert.settingsPatch.alignment, 'center');

  const gridImgs = [
    { id: '1', width: 400, height: 800 },
    { id: '2', width: 400, height: 800 },
    { id: '3', width: 400, height: 800 },
    { id: '4', width: 400, height: 800 },
    { id: '5', width: 400, height: 800 },
    { id: '6', width: 400, height: 800 },
  ];
  const grid = computeAutoArrange(gridImgs, { ...DEFAULT_SETTINGS, layout: 'grid' });
  assert.equal(grid.settingsPatch.scaleMode, 'fit-smallest');
  assert.equal(grid.settingsPatch.autoColumns, false);
  assert.ok((grid.settingsPatch.columns ?? 0) >= 3);

  const overlay = computeAutoArrange(mixed, { ...DEFAULT_SETTINGS, layout: 'overlay' });
  assert.equal(overlay.imagePatches.length, 3);
  // Layers must not all remain stacked on (0, 0)
  const uniqueCoords = new Set(overlay.imagePatches.map((p) => `${p.x},${p.y}`));
  assert.equal(uniqueCoords.size, 3);
});

test('generateBatchRenamedNames applies tokens, counters, zero-padding, case, and prevents collisions', () => {
  const imgs = [
    { id: '1', name: 'ID Front Photo.PNG', width: 800, height: 500 },
    { id: '2', name: 'Passport Scan.jpg', width: 600, height: 800 },
    { id: '3', name: 'Signature.webp', width: 400, height: 150 },
  ];

  const renamed = generateBatchRenamedNames(imgs, {
    pattern: 'kyc-{name}-{nn}',
    startNumber: 1,
    step: 1,
    zeroPad: 2,
    caseMode: 'kebab',
    preserveExtension: true,
  });
  assert.deepEqual(
    renamed.map((r) => r.newName),
    ['kyc-id-front-photo-01.png', 'kyc-passport-scan-02.jpg', 'kyc-signature-03.webp'],
  );

  // When user omits counter token, collision prevention auto-appends counter
  const noToken = generateBatchRenamedNames(imgs, {
    pattern: 'export',
    startNumber: 10,
    step: 5,
    zeroPad: 3,
    caseMode: 'lower',
    preserveExtension: true,
  });
  assert.deepEqual(
    noToken.map((r) => r.newName),
    ['export-010.png', 'export-015.jpg', 'export-020.webp'],
  );
});

test('buildZipArchive produces valid PKZIP local headers and EOCD record', () => {
  const a = new TextEncoder().encode('hello');
  const b = new TextEncoder().encode('world!');
  const zip = buildZipArchive([
    { name: 'doc-01.txt', data: a },
    { name: 'doc-02.txt', data: b },
  ]);

  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50); // Local header signature
  // EOCD starts at zip.length - 22
  const eocdOffset = zip.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint16(eocdOffset + 8, true), 2); // total entries on disk
  assert.equal(view.getUint16(eocdOffset + 10, true), 2); // total entries
});

test('convolveSharpenImageData preserves flat pixels & alpha while boosting edge contrast', () => {
  // 3x3 image: center pixel brighter than neighbors (200 vs 100), alpha 210
  const src = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i++) {
    const v = i === 4 ? 200 : 100;
    src[i * 4] = v;
    src[i * 4 + 1] = v;
    src[i * 4 + 2] = v;
    src[i * 4 + 3] = 210;
  }

  // Strength 0 -> exact copy
  const identity = convolveSharpenImageData(src, 3, 3, 0);
  assert.deepEqual(identity, src);

  // Strength 100 -> center pixel boosted and clamped <= 255, alpha untouched
  const sharpened = convolveSharpenImageData(src, 3, 3, 100);
  assert.equal(sharpened[4 * 4 + 3], 210);
  assert.ok(sharpened[4 * 4] > 200);
  assert.ok(sharpened[4 * 4] <= 255);
  // Neighbor edge pixel (index 1, next to 200) drops slightly for local contrast
  assert.ok(sharpened[1 * 4] < 100);
});

test('navigateHistoryTimeline jumps cleanly to arbitrary past or future steps', () => {
  const past = ['s0', 's1', 's2'];
  const current = 's3';
  const future = ['s4', 's5'];

  const jumpBack = navigateHistoryTimeline(past, current, future, { zone: 'past', index: 1 });
  assert.ok(jumpBack);
  assert.deepEqual(jumpBack.past, ['s0']);
  assert.equal(jumpBack.current, 's1');
  assert.deepEqual(jumpBack.future, ['s2', 's3', 's4', 's5']);

  const jumpForward = navigateHistoryTimeline(
    jumpBack.past,
    jumpBack.current,
    jumpBack.future,
    { zone: 'future', index: 2 },
  );
  assert.ok(jumpForward);
  assert.deepEqual(jumpForward.past, ['s0', 's1', 's2', 's3']);
  assert.equal(jumpForward.current, 's4');
  assert.deepEqual(jumpForward.future, ['s5']);

  assert.equal(navigateHistoryTimeline(past, current, future, { zone: 'past', index: 99 }), null);
});

test('applyBatchColorAdjustments updates only selected tray images when selection is non-empty', () => {
  const imgs = [
    { id: 'img-1', filters: { ...DEFAULT_FILTERS } },
    { id: 'img-2', filters: { ...DEFAULT_FILTERS } },
    { id: 'img-3', filters: { ...DEFAULT_FILTERS } },
  ];

  const scoped = applyBatchColorAdjustments(imgs, ['img-1', 'img-3'], {
    brightness: 120,
    hue: -30,
  });
  assert.equal(scoped[0].filters.brightness, 120);
  assert.equal(scoped[0].filters.hue, -30);
  assert.equal(scoped[1].filters.brightness, 100);
  assert.equal(scoped[1].filters.hue, 0);
  assert.equal(scoped[2].filters.brightness, 120);
  assert.equal(scoped[2].filters.hue, -30);

  const allUpdated = applyBatchColorAdjustments(imgs, [], { contrast: 135, saturation: 80 });
  assert.ok(allUpdated.every((im) => im.filters.contrast === 135 && im.filters.saturation === 80));
});

test('computeSmartAlignment aligns images by focal points and content edges', () => {
  const inputs = [
    {
      id: 'a',
      width: 400,
      height: 400,
      signal: {
        focalX: 0.5,
        focalY: 0.25, // subject near top
        contentBounds: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.7 },
        edgeDensity: 32,
      },
    },
    {
      id: 'b',
      width: 400,
      height: 400,
      signal: {
        focalX: 0.5,
        focalY: 0.75, // subject near bottom
        contentBounds: { left: 0.2, top: 0.3, right: 0.8, bottom: 0.9 },
        edgeDensity: 18,
      },
    },
  ];

  const focal = computeSmartAlignment(inputs, 'grid', 'focal-lineup');
  assert.equal(focal.settingsPatch.layout, 'overlay');
  assert.equal(focal.imagePatches.length, 2);
  // Image 'a' has focalY=0.25 (above center), so center y must shift POSITIVE to put focal point at y=0
  assert.ok((focal.imagePatches[0].y ?? 0) > 0);
  // Image 'b' has focalY=0.75 (below center), so center y must shift NEGATIVE to put focal point at y=0
  assert.ok((focal.imagePatches[1].y ?? 0) < 0);

  const edgeSnap = computeSmartAlignment(inputs, 'grid', 'edge-snap');
  assert.equal(edgeSnap.settingsPatch.layout, 'overlay');
  assert.equal(edgeSnap.imagePatches.length, 2);
  // 'a' has contentH = 0.6*400 = 240; 'b' has contentH = 0.6*400 = 240, and content center Y differs (0.4 vs 0.6)
  assert.ok((edgeSnap.imagePatches[0].y ?? 0) > 0);
  assert.ok((edgeSnap.imagePatches[1].y ?? 0) < 0);

  const cluster = computeSmartAlignment(inputs, 'overlay', 'focal-cluster');
  assert.equal(cluster.imagePatches.length, 2);
  // Hero ('a', higher edgeDensity*contentW) sits near center, satellite 'b' sits to the right
  assert.ok((cluster.imagePatches[1].x ?? 0) > (cluster.imagePatches[0].x ?? 0));
});

test('computeExportDimensions handles canvas, fit-box, and custom-scale modes accurately', () => {
  assert.deepEqual(
    computeExportDimensions(1600, 1200, {
      dimensionMode: 'canvas',
      maxWidth: 1080,
      maxHeight: 1080,
      customScale: 100,
    }),
    { width: 1600, height: 1200, scaled: false },
  );

  // fit-box scales down proportionally to fit inside 1080x1080
  assert.deepEqual(
    computeExportDimensions(1600, 1200, {
      dimensionMode: 'fit-box',
      maxWidth: 1080,
      maxHeight: 1080,
      customScale: 100,
    }),
    { width: 1080, height: 810, scaled: true },
  );

  // fit-box never upscales smaller canvases
  assert.deepEqual(
    computeExportDimensions(800, 600, {
      dimensionMode: 'fit-box',
      maxWidth: 1920,
      maxHeight: 1080,
      customScale: 100,
    }),
    { width: 800, height: 600, scaled: false },
  );

  assert.deepEqual(
    computeExportDimensions(1000, 500, {
      dimensionMode: 'custom-scale',
      maxWidth: 1920,
      maxHeight: 1080,
      customScale: 50,
    }),
    { width: 500, height: 250, scaled: true },
  );
});


