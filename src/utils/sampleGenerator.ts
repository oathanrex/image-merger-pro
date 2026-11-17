import { DEFAULT_FILTERS } from './canvasEngine';
import { extractMetadataFromDataUrl } from './imageMetadata';
import type { MergerImage, MergerSettings } from '../types/merger';

export interface SampleTemplateSpec {
  id: string;
  title: string;
  subtitle: string;
  recommendedSettings: Partial<MergerSettings>;
  buildImages: () => Promise<MergerImage[]>;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode generated sample image'));
    img.src = src;
  });
}

async function canvasToMergerImage(
  canvas: HTMLCanvasElement,
  name: string,
  overrides?: Partial<MergerImage>,
): Promise<MergerImage> {
  const dataUrl = canvas.toDataURL('image/png');
  const img = await loadImageElement(dataUrl);
  const approxBytes = Math.round((dataUrl.length * 3) / 4);
  const metadata = extractMetadataFromDataUrl(dataUrl, {
    fileName: name,
    fileSize: approxBytes,
    width: canvas.width,
    height: canvas.height,
  });

  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    size: approxBytes,
    width: canvas.width,
    height: canvas.height,
    originalWidth: metadata.originalWidth,
    originalHeight: metadata.originalHeight,
    metadata,
    src: dataUrl,
    img,
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    opacity: 100,
    flipH: false,
    flipV: false,
    filters: { ...DEFAULT_FILTERS },
    ...overrides,
  };
}

function drawRoundedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

export const SAMPLE_TEMPLATES: SampleTemplateSpec[] = [
  {
    id: 'id-front-back',
    title: 'ID Card Front & Back',
    subtitle: 'Side-by-side document stitch ready for portal upload or PDF print',
    recommendedSettings: {
      layout: 'horizontal',
      spacing: 24,
      padding: 24,
      scaleMode: 'same-height',
      bgColor: '#ffffff',
      transparentBg: false,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      cornerRadius: 12,
      shadowBlur: 12,
      format: 'jpeg',
      quality: 90,
      filenamePrefix: 'id-card-merged',
    },
    buildImages: async () => {
      // Card 1: Front
      const front = document.createElement('canvas');
      front.width = 720;
      front.height = 450;
      const fctx = front.getContext('2d')!;
      fctx.fillStyle = '#f8fafc';
      fctx.fillRect(0, 0, 720, 450);

      // Header stripes
      fctx.fillStyle = '#ea580c';
      fctx.fillRect(0, 0, 720, 14);
      fctx.fillStyle = '#16a34a';
      fctx.fillRect(0, 436, 720, 14);

      fctx.fillStyle = '#0f172a';
      fctx.font = 'bold 26px sans-serif';
      fctx.fillText('CITIZEN IDENTITY CARD', 36, 62);
      fctx.fillStyle = '#475569';
      fctx.font = '500 15px sans-serif';
      fctx.fillText('FRONT SIDE · DIGITAL SPECIMEN', 36, 88);

      // Portrait placeholder silhouette
      fctx.fillStyle = '#e2e8f0';
      drawRoundedPanel(fctx, 36, 122, 150, 185, 12);
      fctx.fill();
      fctx.fillStyle = '#94a3b8';
      fctx.beginPath();
      fctx.arc(111, 184, 34, 0, Math.PI * 2);
      fctx.fill();
      fctx.beginPath();
      fctx.arc(111, 290, 56, Math.PI, 0);
      fctx.fill();

      // Fields
      fctx.fillStyle = '#0f172a';
      fctx.font = '600 22px sans-serif';
      fctx.fillText('Aarav Sharma', 216, 154);
      fctx.fillStyle = '#475569';
      fctx.font = '500 17px sans-serif';
      fctx.fillText('DOB: 14 Aug 1994', 216, 192);
      fctx.fillText('Gender: Male', 216, 224);
      fctx.fillStyle = '#0f172a';
      fctx.font = 'bold 28px monospace';
      fctx.fillText('4829 7104 9382', 216, 290);

      // Synthetic QR matrix
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(548, 126, 132, 132);
      fctx.strokeStyle = '#cbd5e1';
      fctx.strokeRect(548, 126, 132, 132);
      fctx.fillStyle = '#0f172a';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r * 3 + c * 5) % 2 === 0) {
            fctx.fillRect(560 + c * 13, 138 + r * 13, 10, 10);
          }
        }
      }

      // Card 2: Back
      const back = document.createElement('canvas');
      back.width = 720;
      back.height = 450;
      const bctx = back.getContext('2d')!;
      bctx.fillStyle = '#f8fafc';
      bctx.fillRect(0, 0, 720, 450);

      bctx.fillStyle = '#2563eb';
      bctx.fillRect(0, 0, 720, 14);
      bctx.fillStyle = '#1e293b';
      bctx.fillRect(0, 436, 720, 14);

      bctx.fillStyle = '#0f172a';
      bctx.font = 'bold 24px sans-serif';
      bctx.fillText('ADDRESS & VERIFICATION', 36, 62);
      bctx.fillStyle = '#475569';
      fctx.font = '500 15px sans-serif';
      bctx.font = '500 15px sans-serif';
      bctx.fillText('REVERSE SIDE · DIGITAL SPECIMEN', 36, 88);

      bctx.fillStyle = '#1e293b';
      bctx.font = '500 18px sans-serif';
      bctx.fillText('S/O Rajesh Sharma, Sector 14', 36, 148);
      bctx.fillText('Indiranagar, Bengaluru', 36, 180);
      bctx.fillText('Karnataka — 560038', 36, 212);

      // Barcode bars
      bctx.fillStyle = '#0f172a';
      for (let i = 0; i < 42; i++) {
        const bw = (i % 3 === 0 ? 5 : 2);
        bctx.fillRect(36 + i * 10, 286, bw, 68);
      }

      bctx.fillStyle = '#64748b';
      bctx.font = '500 14px monospace';
      bctx.fillText('REF-ID: 0091-842-VERIFIED', 36, 386);

      return Promise.all([
        canvasToMergerImage(front, 'id-card-front.png'),
        canvasToMergerImage(back, 'id-card-back.png'),
      ]);
    },
  },
  {
    id: 'before-after',
    title: 'Before / After UI Comparison',
    subtitle: 'Vertical or side-by-side product showcase with clean dividers',
    recommendedSettings: {
      layout: 'horizontal',
      spacing: 20,
      padding: 20,
      scaleMode: 'same-height',
      bgColor: '#0f172a',
      transparentBg: false,
      borderWidth: 1,
      borderColor: '#334155',
      cornerRadius: 16,
      shadowBlur: 18,
      format: 'png',
      filenamePrefix: 'ui-comparison',
    },
    buildImages: async () => {
      const makeShot = (title: string, bg: string, accent: string, bars: number[]) => {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 440;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 640, 440);

        ctx.fillStyle = accent;
        ctx.fillRect(36, 36, 140, 28);
        ctx.fillStyle = bg === '#ffffff' ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(title, 36, 104);

        bars.forEach((h, i) => {
          ctx.fillStyle = i === bars.length - 1 ? accent : bg === '#ffffff' ? '#cbd5e1' : '#334155';
          ctx.fillRect(48 + i * 88, 370 - h, 56, h);
        });
        return c;
      };

      const c1 = makeShot('Legacy Baseline', '#ffffff', '#64748b', [90, 110, 85, 130, 120, 140]);
      const c2 = makeShot('Optimized v2.0', '#1e293b', '#3b82f6', [110, 145, 170, 200, 225, 240]);

      return Promise.all([
        canvasToMergerImage(c1, 'before-baseline.png'),
        canvasToMergerImage(c2, 'after-optimized.png'),
      ]);
    },
  },
  {
    id: 'photo-grid-2x2',
    title: '2×2 Editorial Grid',
    subtitle: 'Uniform four-tile collage with crisp spacing and corner radius',
    recommendedSettings: {
      layout: 'grid',
      autoColumns: false,
      columns: 2,
      spacing: 16,
      padding: 24,
      scaleMode: 'fit-smallest',
      bgColor: '#f8fafc',
      transparentBg: false,
      borderWidth: 0,
      cornerRadius: 14,
      shadowBlur: 10,
      format: 'png',
      filenamePrefix: 'editorial-grid',
    },
    buildImages: async () => {
      const specs = [
        { name: 'tile-01-cobalt.png', a: '#1d4ed8', b: '#60a5fa', label: '01 · Cobalt' },
        { name: 'tile-02-emerald.png', a: '#047857', b: '#34d399', label: '02 · Emerald' },
        { name: 'tile-03-amber.png', a: '#b45309', b: '#fbbf24', label: '03 · Amber' },
        { name: 'tile-04-slate.png', a: '#1e293b', b: '#94a3b8', label: '04 · Slate' },
      ];

      return Promise.all(
        specs.map((spec) => {
          const c = document.createElement('canvas');
          c.width = 480;
          c.height = 360;
          const ctx = c.getContext('2d')!;
          const grad = ctx.createLinearGradient(0, 0, 480, 360);
          grad.addColorStop(0, spec.a);
          grad.addColorStop(1, spec.b);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 480, 360);

          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.beginPath();
          ctx.arc(360, 110, 96, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText(spec.label, 36, 312);
          return canvasToMergerImage(c, spec.name);
        }),
      );
    },
  },
  {
    id: 'badge-overlay',
    title: 'Layered Seal Overlay',
    subtitle: 'Free-canvas X/Y, scale, rotation, and opacity composition',
    recommendedSettings: {
      layout: 'overlay',
      padding: 20,
      bgColor: '#f1f5f9',
      transparentBg: false,
      borderWidth: 0,
      cornerRadius: 12,
      shadowBlur: 12,
      format: 'png',
      filenamePrefix: 'overlay-seal',
    },
    buildImages: async () => {
      const base = document.createElement('canvas');
      base.width = 760;
      base.height = 500;
      const bctx = base.getContext('2d')!;
      bctx.fillStyle = '#ffffff';
      bctx.fillRect(0, 0, 760, 500);
      bctx.strokeStyle = '#cbd5e1';
      bctx.lineWidth = 4;
      bctx.strokeRect(20, 20, 720, 460);

      bctx.fillStyle = '#0f172a';
      bctx.font = 'bold 34px sans-serif';
      bctx.fillText('CERTIFICATE OF AUTHENTICITY', 64, 120);
      bctx.fillStyle = '#475569';
      bctx.font = '500 20px sans-serif';
      bctx.fillText('Issued locally via Image Merger Pro Layer Studio', 64, 168);

      bctx.fillStyle = '#e2e8f0';
      bctx.fillRect(64, 224, 520, 16);
      bctx.fillRect(64, 260, 440, 16);
      bctx.fillRect(64, 296, 480, 16);

      const seal = document.createElement('canvas');
      seal.width = 220;
      seal.height = 220;
      const sctx = seal.getContext('2d')!;
      sctx.clearRect(0, 0, 220, 220);
      sctx.strokeStyle = '#2563eb';
      sctx.lineWidth = 8;
      sctx.beginPath();
      sctx.arc(110, 110, 94, 0, Math.PI * 2);
      sctx.stroke();

      sctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
      sctx.fill();

      sctx.strokeStyle = '#2563eb';
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.arc(110, 110, 76, 0, Math.PI * 2);
      sctx.stroke();

      sctx.fillStyle = '#1d4ed8';
      sctx.font = 'bold 26px sans-serif';
      sctx.textAlign = 'center';
      sctx.fillText('VERIFIED', 110, 118);

      return Promise.all([
        canvasToMergerImage(base, 'certificate-base.png', { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }),
        canvasToMergerImage(seal, 'verified-seal.png', { x: 210, y: 95, scale: 90, rotation: -12, opacity: 90 }),
      ]);
    },
  },
];
