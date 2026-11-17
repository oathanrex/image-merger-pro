import type { ImageExifData, ImageMetadataInfo } from '../types/merger';

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  const end = Math.min(bytes.length, start + len);
  let out = '';
  for (let i = start; i < end; i++) {
    const ch = bytes[i];
    if (ch === 0) break;
    if (ch >= 32 && ch <= 126) {
      out += String.fromCharCode(ch);
    }
  }
  return out.trim();
}

function readUint16(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset < 0 || offset + 2 > view.byteLength) return 0;
  return view.getUint16(offset, littleEndian);
}

function readUint32(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset < 0 || offset + 4 > view.byteLength) return 0;
  return view.getUint32(offset, littleEndian);
}

function readInt32(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset < 0 || offset + 4 > view.byteLength) return 0;
  return view.getInt32(offset, littleEndian);
}

function formatExposure(num: number, den: number): string | undefined {
  if (!den || num <= 0) return undefined;
  const val = num / den;
  if (val >= 1) return `${Number(val.toFixed(1))}s`;
  const denom = Math.round(den / num);
  return denom > 1 ? `1/${denom}s` : `${Number(val.toFixed(3))}s`;
}

function orientationLabel(code: number): string {
  switch (code) {
    case 1:
      return '1 (Normal)';
    case 2:
      return '2 (Flip H)';
    case 3:
      return '3 (Rotate 180°)';
    case 4:
      return '4 (Flip V)';
    case 5:
      return '5 (Transpose)';
    case 6:
      return '6 (Rotate 90° CW)';
    case 7:
      return '7 (Transverse)';
    case 8:
      return '8 (Rotate 90° CCW)';
    default:
      return `${code}`;
  }
}

function parseIccProfileName(iccBytes: Uint8Array): string | undefined {
  if (iccBytes.length < 132) return undefined;
  // ICC profile tag count is at offset 128 (big-endian uint32)
  const view = new DataView(iccBytes.buffer, iccBytes.byteOffset, iccBytes.byteLength);
  const tagCount = view.getUint32(128, false);
  const safeCount = Math.min(tagCount, 64);

  for (let i = 0; i < safeCount; i++) {
    const recOff = 132 + i * 12;
    if (recOff + 12 > iccBytes.length) break;
    const sig = readAscii(iccBytes, recOff, 4);
    if (sig === 'desc') {
      const tagOff = view.getUint32(recOff + 4, false);
      const tagSize = view.getUint32(recOff + 8, false);
      if (tagOff + 12 <= iccBytes.length && tagSize > 12) {
        const typeSig = readAscii(iccBytes, tagOff, 4);
        if (typeSig === 'desc') {
          const strLen = view.getUint32(tagOff + 8, false);
          const name = readAscii(iccBytes, tagOff + 12, Math.min(strLen, 80));
          if (name) return name;
        } else if (typeSig === 'mluc' && tagOff + 28 <= iccBytes.length) {
          // Multi-localized Unicode UTF-16BE string
          const strByteLen = view.getUint32(tagOff + 20, false);
          const strRelOff = view.getUint32(tagOff + 24, false);
          const absStart = tagOff + strRelOff;
          if (absStart + strByteLen <= iccBytes.length) {
            let decoded = '';
            for (let p = 0; p + 1 < Math.min(strByteLen, 160); p += 2) {
              const code = view.getUint16(absStart + p, false);
              if (code >= 32 && code <= 126) decoded += String.fromCharCode(code);
            }
            if (decoded.trim()) return decoded.trim();
          }
        }
      }
    }
  }

  // Fallback header color space signature at offset 16 (e.g. 'RGB ', 'CMYK', 'GRAY')
  const space = readAscii(iccBytes, 16, 4);
  return space ? `ICC (${space})` : 'Embedded ICC Profile';
}

function readTiffValueOffset(
  bytes: Uint8Array,
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  type: number,
  count: number,
  littleEndian: boolean,
): number {
  const typeSize =
    type === 1 || type === 2 || type === 7 ? 1 : type === 3 ? 2 : type === 4 || type === 9 ? 4 : type === 5 || type === 10 ? 8 : 1;
  const totalBytes = count * typeSize;
  if (totalBytes <= 4) {
    return entryOffset + 8;
  }
  const relOffset = readUint32(view, entryOffset + 8, littleEndian);
  const abs = tiffStart + relOffset;
  if (abs < tiffStart || abs >= bytes.length) return -1;
  return abs;
}

function parseExifRational(
  view: DataView,
  offset: number,
  littleEndian: boolean,
): { num: number; den: number } | null {
  if (offset < 0 || offset + 8 > view.byteLength) return null;
  const num = readUint32(view, offset, littleEndian);
  const den = readUint32(view, offset + 4, littleEndian);
  return { num, den };
}

function parseIfdEntries(
  bytes: Uint8Array,
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
): Array<{ tag: number; type: number; count: number; valueOffset: number; rawShort: number; rawLong: number }> {
  const absIfd = tiffStart + ifdOffset;
  if (absIfd < tiffStart || absIfd + 2 > bytes.length) return [];
  const count = readUint16(view, absIfd, littleEndian);
  const safeCount = Math.min(count, 128);
  const entries = [];

  for (let i = 0; i < safeCount; i++) {
    const entryOff = absIfd + 2 + i * 12;
    if (entryOff + 12 > bytes.length) break;
    const tag = readUint16(view, entryOff, littleEndian);
    const type = readUint16(view, entryOff + 2, littleEndian);
    const valCount = readUint32(view, entryOff + 4, littleEndian);
    const valueOffset = readTiffValueOffset(bytes, view, tiffStart, entryOff, type, valCount, littleEndian);
    const rawShort = readUint16(view, entryOff + 8, littleEndian);
    const rawLong = readUint32(view, entryOff + 8, littleEndian);
    entries.push({ tag, type, count: valCount, valueOffset, rawShort, rawLong });
  }
  return entries;
}

/**
 * Parses TIFF-structured EXIF block (starting at "II" or "MM") into clean read-only EXIF metadata.
 */
export function parseTiffExifBlock(
  bytes: Uint8Array,
  tiffStart: number,
): { exif: ImageExifData; dpi?: string } {
  const exif: ImageExifData = {};
  if (tiffStart + 8 > bytes.length) return { exif };

  const b0 = bytes[tiffStart];
  const b1 = bytes[tiffStart + 1];
  let littleEndian: boolean;
  if (b0 === 0x49 && b1 === 0x49) littleEndian = true; // 'II'
  else if (b0 === 0x4d && b1 === 0x4d) littleEndian = false; // 'MM'
  else return { exif };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = readUint16(view, tiffStart + 2, littleEndian);
  if (magic !== 42) return { exif };

  const ifd0Offset = readUint32(view, tiffStart + 4, littleEndian);
  const ifd0 = parseIfdEntries(bytes, view, tiffStart, ifd0Offset, littleEndian);

  let xRes: number | undefined;
  let yRes: number | undefined;
  let resUnit = 2; // default inches
  let exifIfdOffset: number | undefined;
  let gpsIfdOffset: number | undefined;

  for (const e of ifd0) {
    switch (e.tag) {
      case 0x010f: // Make
        if (e.valueOffset >= 0) exif.make = readAscii(bytes, e.valueOffset, e.count);
        break;
      case 0x0110: // Model
        if (e.valueOffset >= 0) exif.model = readAscii(bytes, e.valueOffset, e.count);
        break;
      case 0x0112: // Orientation
        exif.orientation = orientationLabel(e.rawShort);
        break;
      case 0x011a: {
        const r = parseExifRational(view, e.valueOffset, littleEndian);
        if (r && r.den > 0) xRes = Math.round(r.num / r.den);
        break;
      }
      case 0x011b: {
        const r = parseExifRational(view, e.valueOffset, littleEndian);
        if (r && r.den > 0) yRes = Math.round(r.num / r.den);
        break;
      }
      case 0x0128: // ResolutionUnit
        resUnit = e.rawShort;
        break;
      case 0x0131: // Software
        if (e.valueOffset >= 0) exif.software = readAscii(bytes, e.valueOffset, e.count);
        break;
      case 0x0132: // DateTime
        if (e.valueOffset >= 0 && !exif.dateTime) {
          exif.dateTime = readAscii(bytes, e.valueOffset, e.count);
        }
        break;
      case 0x8769: // ExifIFDPointer
        exifIfdOffset = e.rawLong;
        break;
      case 0x8825: // GPSInfoIFDPointer
        gpsIfdOffset = e.rawLong;
        break;
    }
  }

  if (exifIfdOffset !== undefined) {
    const subEntries = parseIfdEntries(bytes, view, tiffStart, exifIfdOffset, littleEndian);
    for (const e of subEntries) {
      switch (e.tag) {
        case 0x829a: {
          const r = parseExifRational(view, e.valueOffset, littleEndian);
          if (r) exif.exposureTime = formatExposure(r.num, r.den);
          break;
        }
        case 0x829d: {
          const r = parseExifRational(view, e.valueOffset, littleEndian);
          if (r && r.den > 0) exif.fNumber = `f/${Number((r.num / r.den).toFixed(1))}`;
          break;
        }
        case 0x8827: // ISOSpeedRatings
          exif.iso = e.rawShort;
          break;
        case 0x9003: // DateTimeOriginal
          if (e.valueOffset >= 0) {
            const dt = readAscii(bytes, e.valueOffset, e.count);
            if (dt) exif.dateTime = dt;
          }
          break;
        case 0x920a: {
          const r = parseExifRational(view, e.valueOffset, littleEndian);
          if (r && r.den > 0) exif.focalLength = `${Number((r.num / r.den).toFixed(1))} mm`;
          break;
        }
        case 0xa001: // ColorSpace
          exif.colorSpace =
            e.rawShort === 1 ? 'sRGB' : e.rawShort === 65535 ? 'Uncalibrated' : `Code ${e.rawShort}`;
          break;
        case 0xa434: // LensModel
          if (e.valueOffset >= 0) exif.lensModel = readAscii(bytes, e.valueOffset, e.count);
          break;
      }
    }
  }

  if (gpsIfdOffset !== undefined) {
    const gpsEntries = parseIfdEntries(bytes, view, tiffStart, gpsIfdOffset, littleEndian);
    let latRef = '';
    let lonRef = '';
    let latVal: number | undefined;
    let lonVal: number | undefined;

    const readDms = (off: number): number | undefined => {
      const d = parseExifRational(view, off, littleEndian);
      const m = parseExifRational(view, off + 8, littleEndian);
      const s = parseExifRational(view, off + 16, littleEndian);
      if (!d || !m || !s || !d.den || !m.den || !s.den) return undefined;
      return d.num / d.den + m.num / m.den / 60 + s.num / s.den / 3600;
    };

    for (const e of gpsEntries) {
      if (e.tag === 1 && e.valueOffset >= 0) latRef = readAscii(bytes, e.valueOffset, 2);
      if (e.tag === 2 && e.valueOffset >= 0 && e.count >= 3) latVal = readDms(e.valueOffset);
      if (e.tag === 3 && e.valueOffset >= 0) lonRef = readAscii(bytes, e.valueOffset, 2);
      if (e.tag === 4 && e.valueOffset >= 0 && e.count >= 3) lonVal = readDms(e.valueOffset);
    }
    if (latVal !== undefined && lonVal !== undefined) {
      exif.gpsSummary = `${latVal.toFixed(4)}° ${latRef || 'N'}, ${lonVal.toFixed(4)}° ${lonRef || 'E'}`;
    } else if (gpsEntries.length > 0) {
      exif.gpsSummary = 'Embedded GPS tags';
    }
  }

  let dpi: string | undefined;
  if (xRes && xRes > 0) {
    const unitLabel = resUnit === 3 ? 'DPCM' : 'DPI';
    dpi = yRes && yRes !== xRes ? `${xRes}×${yRes} ${unitLabel}` : `${xRes} ${unitLabel}`;
  }

  return { exif, dpi };
}

function inferFormatFromMimeOrName(mimeType?: string, fileName?: string): string {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('webp')) return 'WebP';
  if (mime.includes('gif')) return 'GIF';
  if (mime.includes('svg')) return 'SVG';
  const ext = fileName?.split('.').pop()?.toUpperCase();
  return ext || 'IMAGE';
}

/**
 * Pure binary parser extracting original dimensions, color profile / bit depth,
 * and EXIF tags from JPEG, PNG, WebP, GIF, or SVG byte buffers.
 */
export function parseImageMetadataFromBytes(
  bytes: Uint8Array,
  opts: {
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    width: number;
    height: number;
    lastModified?: number;
  },
): ImageMetadataInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = inferFormatFromMimeOrName(opts.mimeType, opts.fileName);
  let originalWidth = Math.max(1, Math.round(opts.width));
  let originalHeight = Math.max(1, Math.round(opts.height));
  let bitDepth: string | undefined;
  let colorType: string | undefined;
  let hasAlpha: boolean | undefined;
  let colorProfile = 'sRGB (Untagged / Standard)';
  let dpi: string | undefined;
  let exif: ImageExifData = {};

  // 1. PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    format = 'PNG';
    let pos = 8;
    while (pos + 12 <= bytes.length) {
      const len = readUint32(view, pos, false);
      const chunkType = readAscii(bytes, pos + 4, 4);
      const dataStart = pos + 8;
      if (dataStart + len > bytes.length) break;

      if (chunkType === 'IHDR' && len >= 13) {
        originalWidth = readUint32(view, dataStart, false) || originalWidth;
        originalHeight = readUint32(view, dataStart + 4, false) || originalHeight;
        const depth = bytes[dataStart + 8];
        const ctype = bytes[dataStart + 9];
        bitDepth = `${depth}-bit`;
        if (ctype === 0) {
          colorType = 'Grayscale';
          hasAlpha = false;
        } else if (ctype === 2) {
          colorType = 'RGB';
          hasAlpha = false;
        } else if (ctype === 3) {
          colorType = 'Indexed Palette';
          hasAlpha = false;
        } else if (ctype === 4) {
          colorType = 'Grayscale + Alpha';
          hasAlpha = true;
        } else if (ctype === 6) {
          colorType = 'RGBA';
          hasAlpha = true;
        }
      } else if (chunkType === 'iCCP' && len > 2) {
        const iccName = readAscii(bytes, dataStart, Math.min(len, 79));
        const nullIdx = bytes.subarray(dataStart, dataStart + Math.min(len, 80)).indexOf(0);
        if (iccName) {
          colorProfile = `${iccName} (ICC)`;
        } else if (nullIdx > 0) {
          colorProfile = 'Embedded ICC Profile';
        }
      } else if (chunkType === 'sRGB' && len >= 1) {
        const intents = ['Perceptual', 'Relative Colorimetric', 'Saturation', 'Absolute Colorimetric'];
        const intent = intents[bytes[dataStart]] ?? 'Standard';
        if (!colorProfile.includes('(ICC)')) {
          colorProfile = `sRGB IEC61966 (${intent})`;
        }
      } else if (chunkType === 'pHYs' && len >= 9) {
        const pxPerUnitX = readUint32(view, dataStart, false);
        const unit = bytes[dataStart + 8];
        if (unit === 1 && pxPerUnitX > 0) {
          dpi = `${Math.round(pxPerUnitX * 0.0254)} DPI`;
        }
      } else if (chunkType === 'eXIf' && len >= 8) {
        const parsed = parseTiffExifBlock(bytes, dataStart);
        exif = { ...exif, ...parsed.exif };
        if (parsed.dpi && !dpi) dpi = parsed.dpi;
      } else if (chunkType === 'IEND') {
        break;
      }

      pos = dataStart + len + 4; // skip CRC
    }
  }
  // 2. JPEG Signature: FF D8
  else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    format = 'JPEG';
    hasAlpha = false;
    let pos = 2;
    const iccChunks: Uint8Array[] = [];

    while (pos + 4 <= bytes.length) {
      if (bytes[pos] !== 0xff) {
        pos++;
        continue;
      }
      while (pos < bytes.length && bytes[pos] === 0xff) pos++;
      if (pos >= bytes.length) break;
      const marker = bytes[pos];
      pos++;

      if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > bytes.length) break;

      const segLen = readUint16(view, pos, false);
      const segDataStart = pos + 2;
      const segEnd = pos + segLen;
      if (segLen < 2 || segEnd > bytes.length) break;

      // SOF0 / SOF1 / SOF2 (Frame header with true original resolution & bit precision)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (segDataStart + 6 <= segEnd) {
          const precision = bytes[segDataStart];
          const h = readUint16(view, segDataStart + 1, false);
          const w = readUint16(view, segDataStart + 3, false);
          const components = bytes[segDataStart + 5];
          if (w > 0 && h > 0) {
            originalWidth = w;
            originalHeight = h;
          }
          bitDepth = `${precision}-bit`;
          colorType =
            components === 1
              ? 'Grayscale'
              : components === 3
                ? 'YCbCr (RGB)'
                : components === 4
                  ? 'CMYK'
                  : `${components}-ch`;
        }
      }
      // APP0 JFIF density
      else if (marker === 0xe0 && readAscii(bytes, segDataStart, 4) === 'JFIF') {
        if (segDataStart + 12 <= segEnd) {
          const units = bytes[segDataStart + 7];
          const xd = readUint16(view, segDataStart + 8, false);
          const yd = readUint16(view, segDataStart + 10, false);
          if (units === 1 && xd > 0 && !dpi) {
            dpi = yd !== xd ? `${xd}×${yd} DPI` : `${xd} DPI`;
          } else if (units === 2 && xd > 0 && !dpi) {
            dpi = `${Math.round(xd * 2.54)} DPI`;
          }
        }
      }
      // APP1 EXIF
      else if (marker === 0xe1 && readAscii(bytes, segDataStart, 4) === 'Exif') {
        const tiffStart = segDataStart + 6;
        const parsed = parseTiffExifBlock(bytes, tiffStart);
        exif = { ...exif, ...parsed.exif };
        if (parsed.dpi) dpi = parsed.dpi;
        if (parsed.exif.colorSpace && colorProfile.startsWith('sRGB (Untagged')) {
          colorProfile = `${parsed.exif.colorSpace} (EXIF)`;
        }
      }
      // APP2 ICC_PROFILE
      else if (marker === 0xe2 && readAscii(bytes, segDataStart, 11) === 'ICC_PROFILE') {
        if (segDataStart + 14 < segEnd) {
          iccChunks.push(bytes.subarray(segDataStart + 14, segEnd));
        }
      }

      pos = segEnd;
    }

    if (iccChunks.length > 0) {
      const totalIccLen = iccChunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(totalIccLen);
      let off = 0;
      for (const c of iccChunks) {
        merged.set(c, off);
        off += c.length;
      }
      const iccName = parseIccProfileName(merged);
      if (iccName) colorProfile = `${iccName} (ICC)`;
    }
  }
  // 3. WebP Signature: RIFF....WEBP
  else if (
    bytes.length >= 16 &&
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WEBP'
  ) {
    format = 'WebP';
    bitDepth = '8-bit';
    colorType = 'VP8 YUV / RGBA';
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = readAscii(bytes, pos, 4);
      const chunkSize = readUint32(view, pos + 4, true);
      const dataStart = pos + 8;
      if (dataStart + chunkSize > bytes.length) break;

      if (chunkId === 'VP8X' && chunkSize >= 10) {
        const flags = bytes[dataStart];
        hasAlpha = Boolean(flags & 0x10);
        const w = (bytes[dataStart + 4] | (bytes[dataStart + 5] << 8) | (bytes[dataStart + 6] << 16)) + 1;
        const h = (bytes[dataStart + 7] | (bytes[dataStart + 8] << 8) | (bytes[dataStart + 9] << 16)) + 1;
        if (w > 0 && h > 0) {
          originalWidth = w;
          originalHeight = h;
        }
      } else if (chunkId === 'ICCP') {
        const iccName = parseIccProfileName(bytes.subarray(dataStart, dataStart + chunkSize));
        if (iccName) colorProfile = `${iccName} (ICC)`;
      } else if (chunkId === 'EXIF') {
        const tiffOff = readAscii(bytes, dataStart, 4) === 'Exif' ? dataStart + 6 : dataStart;
        const parsed = parseTiffExifBlock(bytes, tiffOff);
        exif = { ...exif, ...parsed.exif };
        if (parsed.dpi) dpi = parsed.dpi;
      }

      pos = dataStart + chunkSize + (chunkSize % 2);
    }
  }
  // 4. GIF Signature
  else if (bytes.length >= 10 && readAscii(bytes, 0, 3) === 'GIF') {
    format = 'GIF';
    originalWidth = readUint16(view, 6, true) || originalWidth;
    originalHeight = readUint16(view, 8, true) || originalHeight;
    colorType = 'Indexed (256 colors max)';
    bitDepth = '8-bit';
    hasAlpha = true;
  }
  // 5. SVG
  else if (format === 'SVG') {
    colorType = 'Vector XML';
    colorProfile = 'sRGB (CSS/SVG)';
    hasAlpha = true;
  }

  return {
    format,
    mimeType: opts.mimeType || `image/${format.toLowerCase()}`,
    fileSizeBytes: opts.fileSize ?? bytes.length,
    originalWidth,
    originalHeight,
    bitDepth,
    colorType,
    hasAlpha,
    colorProfile,
    dpi,
    lastModified: opts.lastModified,
    exif,
  };
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    if (header.includes(';base64')) {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
  } catch {
    return null;
  }
}

export function extractMetadataFromDataUrl(
  dataUrl: string,
  opts: {
    fileName?: string;
    fileSize?: number;
    width: number;
    height: number;
    lastModified?: number;
  },
): ImageMetadataInfo {
  const mimeMatch = /^data:([^;,]+)/i.exec(dataUrl);
  const mimeType = mimeMatch?.[1];
  const bytes = dataUrlToUint8Array(dataUrl);
  if (bytes) {
    return parseImageMetadataFromBytes(bytes, {
      ...opts,
      mimeType,
    });
  }
  return {
    format: inferFormatFromMimeOrName(mimeType, opts.fileName),
    mimeType: mimeType || 'image/png',
    fileSizeBytes: opts.fileSize ?? 0,
    originalWidth: opts.width,
    originalHeight: opts.height,
    colorProfile: 'sRGB (Browser Decoded)',
    lastModified: opts.lastModified,
    exif: {},
  };
}

export async function extractMetadataFromFile(
  file: File,
  width: number,
  height: number,
): Promise<ImageMetadataInfo> {
  try {
    const buffer = await file.arrayBuffer();
    return parseImageMetadataFromBytes(new Uint8Array(buffer), {
      mimeType: file.type,
      fileName: file.name,
      fileSize: file.size,
      width,
      height,
      lastModified: file.lastModified,
    });
  } catch {
    return {
      format: inferFormatFromMimeOrName(file.type, file.name),
      mimeType: file.type || 'image/unknown',
      fileSizeBytes: file.size,
      originalWidth: width,
      originalHeight: height,
      colorProfile: 'sRGB (Untagged / Standard)',
      lastModified: file.lastModified,
      exif: {},
    };
  }
}
