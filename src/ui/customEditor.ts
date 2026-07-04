import {
  MAX_PHASE_SECONDS,
  MIN_BREATH_SECONDS,
  buildCustomTechnique,
  fmtSeconds,
  type CustomTimings,
  type Technique,
} from '../breath/presets';
import type { Settings } from '../settings';
import { makeDurationChips } from './durations';
import { showScreen } from './screens';

export interface CustomEditorDeps {
  settings: Settings;
  save(): void;
  onBegin(technique: Technique, minutes: number): void;
}

interface StepperDef {
  key: keyof CustomTimings;
  label: string;
  min: number;
}

const ROWS: StepperDef[] = [
  { key: 'inhale', label: 'Breathe in', min: MIN_BREATH_SECONDS },
  { key: 'holdIn', label: 'Hold', min: 0 },
  { key: 'exhale', label: 'Breathe out', min: MIN_BREATH_SECONDS },
  { key: 'holdOut', label: 'Hold', min: 0 },
];

export function setupCustomEditor(deps: CustomEditorDeps): void {
  const { settings } = deps;
  const steppersEl = document.getElementById('custom-steppers')!;
  const previewEl = document.getElementById('custom-preview')!;

  const updatePreview = () => {
    const t = settings.custom;
    const total = t.inhale + t.holdIn + t.exhale + t.holdOut;
    previewEl.textContent = `${buildCustomTechnique(t).pattern} — ${fmtSeconds(total)}s per breath`;
    document.dispatchEvent(new CustomEvent('breathe:custom-changed'));
  };

  const makeStepper = (def: StepperDef) => {
    const row = document.createElement('div');
    row.className = 'stepper';
    row.innerHTML = `
      <span class="stepper-label"></span>
      <button type="button" class="stepper-btn" aria-label="Less"><span>−</span></button>
      <span class="stepper-value"></span>
      <button type="button" class="stepper-btn" aria-label="More"><span>+</span></button>
    `;
    row.querySelector('.stepper-label')!.textContent = def.label;
    const [minus, plus] = row.querySelectorAll<HTMLButtonElement>('.stepper-btn');
    const value = row.querySelector<HTMLElement>('.stepper-value')!;

    const render = () => {
      const v = settings.custom[def.key];
      value.textContent = v === 0 ? 'skip' : `${fmtSeconds(v)}s`;
      minus.disabled = v <= def.min;
      plus.disabled = v >= MAX_PHASE_SECONDS;
    };

    const bump = (delta: number) => {
      const next = Math.min(
        MAX_PHASE_SECONDS,
        Math.max(def.min, settings.custom[def.key] + delta),
      );
      if (next === settings.custom[def.key]) return;
      settings.custom[def.key] = next;
      deps.save();
      render();
      updatePreview();
    };

    // Tap steps once; press-and-hold repeats after a beat.
    for (const [btn, delta] of [
      [minus, -0.5],
      [plus, 0.5],
    ] as const) {
      let holdTimer = 0;
      let repeatTimer = 0;
      btn.addEventListener('pointerdown', (e) => {
        btn.setPointerCapture(e.pointerId);
        bump(delta);
        holdTimer = window.setTimeout(() => {
          repeatTimer = window.setInterval(() => bump(delta), 120);
        }, 400);
      });
      const stop = () => {
        clearTimeout(holdTimer);
        clearInterval(repeatTimer);
      };
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('lostpointercapture', stop);
    }

    steppersEl.append(row);
    render();
  };

  for (const def of ROWS) makeStepper(def);
  updatePreview();

  makeDurationChips(document.getElementById('custom-durations')!, settings.durationMin, (min) => {
    settings.durationMin = min;
    deps.save();
  });

  document.getElementById('custom-back')!.addEventListener('click', () => showScreen('home'));
  document.getElementById('custom-begin')!.addEventListener('click', () => {
    deps.onBegin(
      buildCustomTechnique(settings.custom),
      settings.durationMin === 0 ? Infinity : settings.durationMin,
    );
  });
}
