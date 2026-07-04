import type { Snapshot } from '../breath/engine';
import type { VisualRenderer } from './orb';

/**
 * Reduced-motion visual: one theme-colored circle scaled by the eased breath
 * value. Compositor-only (transform + opacity), no canvas, no WASM at all.
 */
export class CalmVisual implements VisualRenderer {
  private readonly container: HTMLElement;
  private readonly circle: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.circle = container.querySelector<HTMLElement>('.calm-circle')!;
    container.hidden = false;
  }

  setTheme(): void {
    // Colors come from the CSS theme tokens; nothing to do here.
  }

  frame(snap: Snapshot): void {
    const scale = 0.45 + 0.55 * snap.breath;
    this.circle.style.transform = `scale(${scale.toFixed(4)})`;
    this.circle.style.opacity = snap.state === 'paused' || snap.state === 'complete' ? '0.5' : '1';
  }

  destroy(): void {
    this.container.hidden = true;
  }
}
