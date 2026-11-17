import type { ExportPreset, ThemeMode, UserPreset, WorkspaceTelemetry } from '../types/merger';

const THEME_KEY = 'imp_theme_v1';
const PRESETS_KEY = 'imp_presets_v1';
const EXPORT_PRESETS_KEY = 'imp_export_presets_v1';
const TELEMETRY_KEY = 'imp_telemetry_v1';

export function loadThemePreference(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
}

export function saveThemePreference(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: UserPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

export function loadExportPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(EXPORT_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExportPresets(presets: ExportPreset[]): void {
  try {
    localStorage.setItem(EXPORT_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

export function loadTelemetry(): WorkspaceTelemetry {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return { totalExports: 0, totalImagesProcessed: 0, lastExportAt: null };
    const parsed = JSON.parse(raw);
    return {
      totalExports: typeof parsed.totalExports === 'number' ? parsed.totalExports : 0,
      totalImagesProcessed:
        typeof parsed.totalImagesProcessed === 'number' ? parsed.totalImagesProcessed : 0,
      lastExportAt: typeof parsed.lastExportAt === 'number' ? parsed.lastExportAt : null,
    };
  } catch {
    return { totalExports: 0, totalImagesProcessed: 0, lastExportAt: null };
  }
}

export function recordExportTelemetry(imagesCount: number): WorkspaceTelemetry {
  const current = loadTelemetry();
  const next: WorkspaceTelemetry = {
    totalExports: current.totalExports + 1,
    totalImagesProcessed: current.totalImagesProcessed + Math.max(0, imagesCount),
    lastExportAt: Date.now(),
  };
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
