import { clampTimings, type CustomTimings } from './breath/presets';

export interface Settings {
  theme: string;
  lastTechnique: string;
  custom: CustomTimings;
  /** Session length in minutes; 0 = open-ended. */
  durationMin: number;
  largeText: boolean;
}

const KEY = 'breathe:v1';

const DEFAULTS: Settings = {
  theme: 'twilight',
  lastTechnique: 'box',
  custom: { inhale: 4, holdIn: 4, exhale: 6, holdOut: 0 },
  durationMin: 5,
  largeText: false,
};

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, custom: { ...DEFAULTS.custom } };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const custom = { ...DEFAULTS.custom, ...(parsed.custom ?? {}) };
    return {
      theme: typeof parsed.theme === 'string' ? parsed.theme : DEFAULTS.theme,
      lastTechnique:
        typeof parsed.lastTechnique === 'string' ? parsed.lastTechnique : DEFAULTS.lastTechnique,
      // Snap stored timings to the same 0.5s grid the editor and engine use,
      // so a hand-edited or legacy value can't show one pace and run another.
      custom: clampTimings({
        inhale: num(custom.inhale, DEFAULTS.custom.inhale),
        holdIn: num(custom.holdIn, DEFAULTS.custom.holdIn),
        exhale: num(custom.exhale, DEFAULTS.custom.exhale),
        holdOut: num(custom.holdOut, DEFAULTS.custom.holdOut),
      }),
      durationMin: Math.max(0, num(parsed.durationMin, DEFAULTS.durationMin)),
      largeText: parsed.largeText === true,
    };
  } catch {
    // Private-mode Safari or corrupted storage — run on defaults.
    return { ...DEFAULTS, custom: { ...DEFAULTS.custom } };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}
