import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImageMetadataFromBytes } from './imageMetadata';

function buildMinimalPngWithChunks(): Uint8Array {
  // PNG header + IHDR (1200x800, 8-bit, colorType 6 RGBA) + pHYs (11811 px/m -> 300 DPI) + iCCP ("Display P3") + IEND
  const chunks: Uint8Array[] = [];
  const pushChunk = (type: string, data: Uint8Array) => {
    const buf = new Uint8Array(12 + data.length);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
    buf.set(data, 8);
    // dummy CRC (parser skips CRC)
    chunks.push(buf);
  };

  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  ihdrDv.setUint32(0, 1200, false);
  ihdrDv.setUint32(4, 800, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  pushChunk('IHDR', ihdr);

  const phys = new Uint8Array(9);
  const physDv = new DataView(phys.buffer);
  physDv.setUint32(0, 11811, false);
  physDv.setUint32(4, 11811, false);
  phys[8] = 1; // meters
  pushChunk('pHYs', phys);

  const iccpName = 'Display P3';
  const iccp = new Uint8Array(iccpName.length + 2);
  for (let i = 0; i < iccpName.length; i++) iccp[i] = iccpName.charCodeAt(i);
  iccp[iccpName.length] = 0;
  iccp[iccpName.length + 1] = 0;
  pushChunk('iCCP', iccp);

  pushChunk('IEND', new Uint8Array(0));

  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const total = sig.length + chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  out.set(sig, 0);
  let off = sig.length;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function buildMinimalJpegWithExif(): Uint8Array {
  // Build Little-Endian TIFF block:
  // IFD0 @ offset 8: Make ('Canon'), Model ('EOS R5'), Orientation (6), ExifIFDPointer
  const tiff = new Uint8Array(256);
  const tv = new DataView(tiff.buffer);
  // Header 'II', 42, IFD0 @ 8
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  tv.setUint16(2, 42, true);
  tv.setUint32(4, 8, true);

  // IFD0: 4 entries starting at 8 -> 2 + 4*12 + 4 = 54 bytes -> ends at 62
  tv.setUint16(8, 4, true);
  let cursor = 10;
  let heap = 64;

  const writeAsciiEntry = (tag: number, str: string) => {
    const bytes = new TextEncoder().encode(str + '\0');
    tv.setUint16(cursor, tag, true);
    tv.setUint16(cursor + 2, 2, true); // ASCII
    tv.setUint32(cursor + 4, bytes.length, true);
    tv.setUint32(cursor + 8, heap, true);
    tiff.set(bytes, heap);
    heap += bytes.length;
    cursor += 12;
  };

  writeAsciiEntry(0x010f, 'Canon');
  writeAsciiEntry(0x0110, 'EOS R5');

  // Orientation = 6 (SHORT)
  tv.setUint16(cursor, 0x0112, true);
  tv.setUint16(cursor + 2, 3, true);
  tv.setUint32(cursor + 4, 1, true);
  tv.setUint16(cursor + 8, 6, true);
  cursor += 12;

  // ExifIFDPointer @ 120
  const exifIfdOffset = 120;
  tv.setUint16(cursor, 0x8769, true);
  tv.setUint16(cursor + 2, 4, true);
  tv.setUint32(cursor + 4, 1, true);
  tv.setUint32(cursor + 8, exifIfdOffset, true);

  // ExifIFD: 3 entries (ISO 400, FNumber f/2.8, ColorSpace sRGB=1)
  tv.setUint16(exifIfdOffset, 3, true);
  let ecur = exifIfdOffset + 2;
  let eheap = 180;

  // FNumber 28/10 -> f/2.8
  tv.setUint16(ecur, 0x829d, true);
  tv.setUint16(ecur + 2, 5, true); // RATIONAL
  tv.setUint32(ecur + 4, 1, true);
  tv.setUint32(ecur + 8, eheap, true);
  tv.setUint32(eheap, 28, true);
  tv.setUint32(eheap + 4, 10, true);
  eheap += 8;
  ecur += 12;

  // ISO 400
  tv.setUint16(ecur, 0x8827, true);
  tv.setUint16(ecur + 2, 3, true);
  tv.setUint32(ecur + 4, 1, true);
  tv.setUint16(ecur + 8, 400, true);
  ecur += 12;

  // ColorSpace = 1 (sRGB)
  tv.setUint16(ecur, 0xa001, true);
  tv.setUint16(ecur + 2, 3, true);
  tv.setUint32(ecur + 4, 1, true);
  tv.setUint16(ecur + 8, 1, true);

  // APP1 segment: FF E1 <len> "Exif\0\0" <tiff>
  const app1Len = 2 + 6 + tiff.length;
  const app1 = new Uint8Array(2 + app1Len);
  const av = new DataView(app1.buffer);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  av.setUint16(2, app1Len, false);
  app1.set(new TextEncoder().encode('Exif\0\0'), 4);
  app1.set(tiff, 10);

  // SOF0 segment: FF C0 <len=17> precision=8, H=2400, W=3600, components=3
  const sof0 = new Uint8Array(19);
  const sv = new DataView(sof0.buffer);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sv.setUint16(2, 17, false);
  sof0[4] = 8;
  sv.setUint16(5, 2400, false);
  sv.setUint16(7, 3600, false);
  sof0[9] = 3;

  const soi = new Uint8Array([0xff, 0xd8]);
  const eoi = new Uint8Array([0xff, 0xd9]);
  const out = new Uint8Array(soi.length + app1.length + sof0.length + eoi.length);
  out.set(soi, 0);
  out.set(app1, soi.length);
  out.set(sof0, soi.length + app1.length);
  out.set(eoi, soi.length + app1.length + sof0.length);
  return out;
}

test('parseImageMetadataFromBytes extracts PNG IHDR resolution, bit depth, DPI, and iCCP profile', () => {
  const pngBytes = buildMinimalPngWithChunks();
  const meta = parseImageMetadataFromBytes(pngBytes, {
    fileName: 'hero-asset.png',
    mimeType: 'image/png',
    width: 600,
    height: 400,
  });

  assert.equal(meta.format, 'PNG');
  assert.equal(meta.originalWidth, 1200);
  assert.equal(meta.originalHeight, 800);
  assert.equal(meta.bitDepth, '8-bit');
  assert.equal(meta.colorType, 'RGBA');
  assert.equal(meta.hasAlpha, true);
  assert.equal(meta.dpi, '300 DPI');
  assert.equal(meta.colorProfile, 'Display P3 (ICC)');
});

test('parseImageMetadataFromBytes extracts JPEG SOF0 resolution and Little-Endian EXIF tags', () => {
  const jpgBytes = buildMinimalJpegWithExif();
  const meta = parseImageMetadataFromBytes(jpgBytes, {
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    width: 1800,
    height: 1200,
  });

  assert.equal(meta.format, 'JPEG');
  assert.equal(meta.originalWidth, 3600);
  assert.equal(meta.originalHeight, 2400);
  assert.equal(meta.bitDepth, '8-bit');
  assert.equal(meta.colorType, 'YCbCr (RGB)');
  assert.equal(meta.hasAlpha, false);
  assert.equal(meta.colorProfile, 'sRGB (EXIF)');
  assert.equal(meta.exif.make, 'Canon');
  assert.equal(meta.exif.model, 'EOS R5');
  assert.equal(meta.exif.orientation, '6 (Rotate 90° CW)');
  assert.equal(meta.exif.fNumber, 'f/2.8');
  assert.equal(meta.exif.iso, 400);
});
