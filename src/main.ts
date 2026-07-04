import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import './styles/main.css';

import { initWasm, type Breathe } from './lib/wasm';
import { loadSettings, saveSettings } from './settings';
import { applyTheme, type Theme } from './theme';
import type { Technique } from './breath/presets';
import { OrbVisual, type VisualRenderer } from './render/orb';
import { CalmVisual } from './render/calm';
import { setupHome } from './ui/home';
import { setupCustomEditor } from './ui/customEditor';
import { setupSession, type SessionSummary } from './ui/session';
import { setupComplete } from './ui/complete';
import { showScreen, type ScreenName } from './ui/screens';

const settings = loadSettings();
const save = () => saveSettings(settings);
let theme: Theme = applyTheme(settings.theme);

// Under prefers-reduced-motion the particle orb is replaced by a single
// smoothly-scaling circle — the WASM module is never even instantiated.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wasm: Breathe | null = reducedMotion ? null : await initWasm();

const sessionSection = document.querySelector<HTMLElement>('[data-screen="session"]')!;
const orbCanvas = document.getElementById('orb-canvas') as HTMLCanvasElement;
const calmContainer = document.getElementById('calm-visual')!;
if (reducedMotion) orbCanvas.hidden = true;

function createVisual(t: Theme): VisualRenderer {
  if (wasm) return new OrbVisual(wasm, orbCanvas, sessionSection, t);
  return new CalmVisual(calmContainer);
}

let lastRun: { technique: Technique; minutes: number } | null = null;

const session = setupSession({
  createVisual,
  getTheme: () => theme,
  onComplete: (summary: SessionSummary) => complete.show(summary),
  onExit: () => showScreen('home'),
});

const complete = setupComplete({
  onAgain: () => {
    if (lastRun) session.start(lastRun.technique, lastRun.minutes);
  },
  onDone: () => showScreen('home'),
});

const startSession = (technique: Technique, minutes: number) => {
  lastRun = { technique, minutes };
  session.start(technique, minutes);
};

setupHome({
  settings,
  save,
  onStart: startSession,
  onTheme: (t) => {
    theme = t;
    session.setTheme(t);
  },
});

setupCustomEditor({
  settings,
  save,
  onBegin: startSession,
});

// ---- hash routing (home/custom only; sessions start deliberately) ----
const routeFromHash = (): ScreenName => (location.hash === '#custom' ? 'custom' : 'home');
window.addEventListener('hashchange', () => {
  if (!session.isActive()) showScreen(routeFromHash());
});
showScreen(routeFromHash());
