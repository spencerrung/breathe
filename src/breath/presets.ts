export type PhaseKind = 'inhale' | 'inhale2' | 'hold-in' | 'exhale' | 'hold-out';

export interface PhaseSpec {
  kind: PhaseKind;
  seconds: number;
  label: string;
  /** Normalized breath radius at phase start/end (0 = empty, 1 = full). */
  from: number;
  to: number;
}

export interface Technique {
  id: string;
  name: string;
  pattern: string;
  tagline: string;
  phases: PhaseSpec[];
  defaultMinutes: number;
}

export interface CustomTimings {
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

/**
 * The one formatter for seconds shown anywhere in the UI (tiles, steppers,
 * dial). Snaps to a 0.1 grid first so float noise (4.300000000000001) can
 * never leak into display, then drops a trailing .0.
 */
export function fmtSeconds(v: number): string {
  const snapped = Math.round(v * 10) / 10;
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
}

const inhale = (seconds: number, from = 0, to = 1): PhaseSpec => ({
  kind: 'inhale',
  seconds,
  label: 'Breathe in',
  from,
  to,
});
const holdIn = (seconds: number, at = 1): PhaseSpec => ({
  kind: 'hold-in',
  seconds,
  label: 'Hold',
  from: at,
  to: at,
});
const exhale = (seconds: number, from = 1, to = 0): PhaseSpec => ({
  kind: 'exhale',
  seconds,
  label: 'Breathe out',
  from,
  to,
});
const holdOut = (seconds: number): PhaseSpec => ({
  kind: 'hold-out',
  seconds,
  label: 'Hold',
  from: 0,
  to: 0,
});

export const PRESETS: Technique[] = [
  {
    id: 'box',
    name: 'Box breathing',
    pattern: '4 · 4 · 4 · 4',
    tagline: 'Steady the mind, four sides at a time.',
    phases: [inhale(4), holdIn(4), exhale(4), holdOut(4)],
    defaultMinutes: 5,
  },
  {
    id: '478',
    name: '4-7-8',
    pattern: '4 · 7 · 8',
    tagline: 'A long, unwinding exhale for rest and sleep.',
    phases: [inhale(4), holdIn(7), exhale(8)],
    defaultMinutes: 5,
  },
  {
    id: 'coherent',
    name: 'Coherent breathing',
    pattern: '5.5 · 5.5',
    tagline: 'Slow, even waves — about five breaths a minute.',
    phases: [inhale(5.5), exhale(5.5)],
    defaultMinutes: 10,
  },
  {
    id: 'triangle',
    name: 'Triangle breathing',
    pattern: '4 · 4 · 4',
    tagline: 'In, hold, out. A simple three-count rhythm.',
    phases: [inhale(4), holdIn(4), exhale(4)],
    defaultMinutes: 5,
  },
  {
    id: 'extended',
    name: 'Extended exhale',
    pattern: '4 · 6',
    tagline: 'Exhale longer than you inhale to settle the body.',
    phases: [inhale(4), exhale(6)],
    defaultMinutes: 5,
  },
  {
    id: 'sigh',
    name: 'Physiological sigh',
    pattern: '2.5 + 1.2 · 6',
    tagline: 'Two sips of air, one long letting-go.',
    phases: [
      inhale(2.5, 0, 0.82),
      { kind: 'inhale2', seconds: 1.2, label: 'Sip in a little more', from: 0.82, to: 1 },
      { kind: 'exhale', seconds: 6, label: 'Long breath out', from: 1, to: 0 },
    ],
    defaultMinutes: 2,
  },
];

export const MIN_BREATH_SECONDS = 0.5;
export const MAX_PHASE_SECONDS = 15;

export function clampTimings(t: CustomTimings): CustomTimings {
  const breath = (v: number) =>
    Math.min(MAX_PHASE_SECONDS, Math.max(MIN_BREATH_SECONDS, Math.round(v * 2) / 2));
  const hold = (v: number) =>
    Math.min(MAX_PHASE_SECONDS, Math.max(0, Math.round(v * 2) / 2));
  return {
    inhale: breath(t.inhale),
    holdIn: hold(t.holdIn),
    exhale: breath(t.exhale),
    holdOut: hold(t.holdOut),
  };
}

export function buildCustomTechnique(raw: CustomTimings): Technique {
  const t = clampTimings(raw);
  const phases: PhaseSpec[] = [inhale(t.inhale)];
  if (t.holdIn > 0) phases.push(holdIn(t.holdIn));
  phases.push(exhale(t.exhale));
  if (t.holdOut > 0) phases.push(holdOut(t.holdOut));

  const pattern = [t.inhale, t.holdIn, t.exhale, t.holdOut]
    .filter((v, i) => v > 0 || i === 0 || i === 2)
    .map(fmtSeconds)
    .join(' · ');

  return {
    id: 'custom',
    name: 'Your own pace',
    pattern,
    tagline: 'A rhythm tuned just for you.',
    phases,
    defaultMinutes: 5,
  };
}
