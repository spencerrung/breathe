import { BreathSession, type Snapshot } from '../breath/engine';
import { fmtSeconds, type Technique } from '../breath/presets';
import { runWhenVisible, type LoopHandle } from '../lib/lifecycle';
import type { VisualRenderer } from '../render/orb';
import type { Theme } from '../theme';
import { showScreen } from './screens';

export interface SessionSummary {
  technique: Technique;
  minutes: number; // Infinity for open-ended
  elapsedSeconds: number;
  cycles: number;
}

export interface SessionDeps {
  createVisual(theme: Theme): VisualRenderer;
  getTheme(): Theme;
  onComplete(summary: SessionSummary): void;
  onExit(): void;
}

export interface SessionController {
  start(technique: Technique, minutes: number): void;
  isActive(): boolean;
  setTheme(theme: Theme): void;
}

const ARC_CIRCUMFERENCE = 2 * Math.PI * 44; // matches r=44 in the SVG
const CONTROLS_HIDE_MS = 3000;

export function setupSession(deps: SessionDeps): SessionController {
  const section = document.querySelector<HTMLElement>('[data-screen="session"]')!;
  const phaseText = document.getElementById('phase-text')!;
  const dialArc = document.getElementById('dial-arc') as unknown as SVGCircleElement;
  const dialSeconds = document.getElementById('dial-seconds')!;
  const progressBar = document.getElementById('session-progress')!;
  const progressFill = document.getElementById('session-progress-fill')!;
  const controls = document.getElementById('session-controls')!;
  const btnPause = document.getElementById('btn-pause')!;
  const btnFullscreen = document.getElementById('btn-fullscreen')!;
  const btnExit = document.getElementById('btn-exit')!;

  dialArc.style.strokeDasharray = String(ARC_CIRCUMFERENCE);

  let engine: BreathSession | null = null;
  let visual: VisualRenderer | null = null;
  let loop: LoopHandle | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let hideTimer = 0;
  let lastLabel = '';
  let lastSeconds = '';
  let minutes = 0;

  // ---- controls visibility ----
  const showControls = () => {
    controls.classList.remove('hidden');
    section.classList.remove('idle-cursor');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      controls.classList.add('hidden');
      section.classList.add('idle-cursor');
    }, CONTROLS_HIDE_MS);
  };

  // ---- wake lock ----
  const acquireWakeLock = async () => {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* unsupported or denied — the session still works */
    }
  };
  const releaseWakeLock = () => {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  };

  // ---- pause/resume ----
  const setPauseIcon = (paused: boolean) => {
    btnPause.textContent = paused ? '▶' : '⏸';
    btnPause.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  };
  const togglePause = () => {
    if (!engine) return;
    const snap = engine.snapshot();
    if (snap.state === 'paused') {
      engine.resume();
      setPauseIcon(false);
    } else if (snap.state === 'running' || snap.state === 'countdown') {
      engine.pause();
      setPauseIcon(true);
    }
    showControls();
  };

  // ---- fullscreen ----
  const fullscreenSupported = document.fullscreenEnabled;
  if (!fullscreenSupported) btnFullscreen.hidden = true;
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  };
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement !== null;
    btnFullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  });

  // ---- per-frame overlay updates ----
  const updateOverlay = (snap: Snapshot) => {
    if (snap.label !== lastLabel) {
      lastLabel = snap.label;
      phaseText.textContent = snap.label;
      phaseText.dataset.kind = snap.kind;
    }
    // A 5.5s phase should open at "5.5" (matching the technique card), not a
    // ceil'd "6", then tick 5 · 4 · 3 · 2 · 1 like any whole-second phase.
    let secs = '';
    if (snap.secondsLeft > 0) {
      const whole = Math.ceil(snap.secondsLeft);
      secs = whole > snap.phaseSeconds ? fmtSeconds(snap.phaseSeconds) : String(whole);
    }
    if (secs !== lastSeconds) {
      lastSeconds = secs;
      dialSeconds.textContent = secs;
    }
    dialArc.style.strokeDashoffset = String(ARC_CIRCUMFERENCE * (1 - snap.phaseProgress));
    if (snap.sessionProgress >= 0) {
      progressFill.style.width = `${(snap.sessionProgress * 100).toFixed(2)}%`;
    }
  };

  // ---- lifecycle ----
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'Escape' && !document.fullscreenElement) {
      // With fullscreen active, Esc exits fullscreen first (browser behavior).
      exit();
    }
  };

  const onVisibility = () => {
    if (!engine) return;
    if (document.hidden) {
      // Never let a guided session run silently in a background tab.
      if (engine.snapshot().state === 'running' || engine.snapshot().state === 'countdown') {
        engine.pause();
        setPauseIcon(true);
      }
    } else if (wakeLock === null) {
      void acquireWakeLock();
    }
  };

  const cleanup = () => {
    loop?.destroy();
    loop = null;
    visual?.destroy();
    visual = null;
    engine = null;
    releaseWakeLock();
    clearTimeout(hideTimer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    section.removeEventListener('pointerdown', showControls);
    section.removeEventListener('pointermove', showControls);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  const exit = () => {
    if (!engine) return;
    engine.stop();
    cleanup();
    deps.onExit();
  };

  const finish = () => {
    if (!engine) return;
    const summary: SessionSummary = {
      technique: engine.technique,
      minutes,
      elapsedSeconds: engine.elapsedSeconds,
      cycles: engine.cyclesCompleted,
    };
    cleanup();
    deps.onComplete(summary);
  };

  const tick = (dt: number) => {
    if (!engine || !visual) return;
    const snap = engine.tick(dt);
    visual.frame(snap, dt);
    updateOverlay(snap);
    if (snap.state === 'complete') finish();
  };

  btnPause.addEventListener('click', togglePause);
  btnFullscreen.addEventListener('click', toggleFullscreen);
  btnExit.addEventListener('click', exit);

  return {
    start(technique, mins) {
      if (engine) cleanup(); // defensive: never run two sessions at once
      minutes = mins;
      engine = new BreathSession(technique, mins);
      engine.start();
      visual = deps.createVisual(deps.getTheme());
      lastLabel = '';
      lastSeconds = '';
      setPauseIcon(false);
      progressBar.hidden = mins === Infinity;
      progressFill.style.width = '0%';
      updateOverlay(engine.snapshot());

      showScreen('session');
      showControls();
      void acquireWakeLock();
      window.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVisibility);
      section.addEventListener('pointerdown', showControls);
      section.addEventListener('pointermove', showControls);
      loop = runWhenVisible(section, tick);
    },
    isActive: () => engine !== null,
    setTheme(theme) {
      visual?.setTheme(theme);
    },
  };
}
