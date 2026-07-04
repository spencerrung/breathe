import type { PhaseKind, Technique } from './presets';

export type SessionState = 'idle' | 'countdown' | 'running' | 'paused' | 'complete';

export interface Snapshot {
  state: SessionState;
  label: string;
  kind: PhaseKind | 'countdown';
  secondsLeft: number;
  /** Full duration of the current phase — lets the UI format "5.5" correctly. */
  phaseSeconds: number;
  phaseProgress: number;
  cycle: number;
  /** 0..1 for timed sessions, -1 for an open-ended one. */
  sessionProgress: number;
  /** Eased normalized breath radius, 0..1. */
  breath: number;
  /** 0.15 baseline; ramps toward 1 during holds. */
  shimmer: number;
}

export function easeInOutSine(p: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)));
}

const COUNTDOWN_SECONDS = 3;
const SHIMMER_BASE = 0.15;
const SHIMMER_RAMP = 1 / 0.5; // full swing over ~0.5s

export class BreathSession {
  readonly technique: Technique;
  /** Session length in seconds; Infinity = open-ended. */
  readonly durationSec: number;

  private state: SessionState = 'idle';
  private phaseIndex = 0;
  private tInPhase = 0;
  private countdownLeft = 0;
  private elapsed = 0;
  private cycles = 0;
  private endPending = false;
  private shimmer = SHIMMER_BASE;

  constructor(technique: Technique, minutes: number) {
    if (technique.phases.length === 0) throw new Error('technique has no phases');
    this.technique = technique;
    this.durationSec = minutes === Infinity ? Infinity : minutes * 60;
  }

  start(): void {
    this.state = 'countdown';
    this.countdownLeft = COUNTDOWN_SECONDS;
    this.phaseIndex = 0;
    this.tInPhase = 0;
    this.elapsed = 0;
    this.cycles = 0;
    this.endPending = false;
    this.shimmer = SHIMMER_BASE;
  }

  pause(): void {
    if (this.state === 'running' || this.state === 'countdown') this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = this.countdownLeft > 0 ? 'countdown' : 'running';
  }

  stop(): void {
    this.state = 'idle';
  }

  get cyclesCompleted(): number {
    return this.cycles;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  tick(dt: number): Snapshot {
    if (this.state === 'countdown') {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.state = 'running';
        this.tInPhase = -this.countdownLeft; // carry the overshoot into phase 1
        this.countdownLeft = 0;
      }
    } else if (this.state === 'running') {
      this.elapsed += dt;
      this.tInPhase += dt;
      if (this.durationSec !== Infinity && this.elapsed >= this.durationSec) {
        this.endPending = true; // finish the current cycle, never cut a breath short
      }

      let phase = this.technique.phases[this.phaseIndex];
      while (this.tInPhase >= phase.seconds) {
        this.tInPhase -= phase.seconds;
        this.phaseIndex++;
        if (this.phaseIndex >= this.technique.phases.length) {
          this.phaseIndex = 0;
          this.cycles++;
          if (this.endPending) {
            this.state = 'complete';
            this.tInPhase = 0;
            break;
          }
        }
        phase = this.technique.phases[this.phaseIndex];
      }
    }

    const holding = this.state === 'running' && this.currentKind().startsWith('hold');
    const target = holding ? 1 : SHIMMER_BASE;
    const step = SHIMMER_RAMP * dt;
    this.shimmer += Math.min(step, Math.max(-step, target - this.shimmer));

    return this.snapshot();
  }

  snapshot(): Snapshot {
    const phase = this.technique.phases[this.phaseIndex];

    if (this.state === 'countdown') {
      return {
        state: 'countdown',
        label: 'Get comfortable',
        kind: 'countdown',
        secondsLeft: this.countdownLeft,
        phaseSeconds: COUNTDOWN_SECONDS,
        phaseProgress: 1 - this.countdownLeft / COUNTDOWN_SECONDS,
        cycle: 0,
        sessionProgress: this.durationSec === Infinity ? -1 : 0,
        breath: 0,
        shimmer: this.shimmer,
      };
    }

    const p = phase.seconds > 0 ? Math.min(1, Math.max(0, this.tInPhase / phase.seconds)) : 1;
    const breath =
      this.state === 'complete'
        ? 0
        : phase.from + (phase.to - phase.from) * easeInOutSine(p);

    return {
      state: this.state,
      label: this.state === 'paused' ? 'Paused' : phase.label,
      kind: phase.kind,
      secondsLeft: Math.max(0, phase.seconds - this.tInPhase),
      phaseSeconds: phase.seconds,
      phaseProgress: p,
      cycle: this.cycles,
      sessionProgress:
        this.durationSec === Infinity ? -1 : Math.min(1, this.elapsed / this.durationSec),
      breath,
      shimmer: this.shimmer,
    };
  }

  private currentKind(): PhaseKind {
    return this.technique.phases[this.phaseIndex].kind;
  }
}
