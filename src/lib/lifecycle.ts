export interface LoopHandle {
  destroy(): void;
}

/**
 * Runs `tick` on requestAnimationFrame only while `section` is on screen and
 * the tab is visible. (Reduced motion is handled upstream by swapping the
 * renderer, not by pausing the loop — the breath engine still needs ticking.)
 */
export function runWhenVisible(section: HTMLElement, tick: (dt: number) => void): LoopHandle {
  let raf = 0;
  let last = 0;
  let visible = false;
  let destroyed = false;

  const frame = (t: number) => {
    raf = 0;
    const dt = last === 0 ? 1 / 60 : Math.min((t - last) / 1000, 1 / 30);
    last = t;
    tick(dt);
    schedule();
  };

  const schedule = () => {
    // The destroyed guard matters when destroy() is called from inside tick():
    // frame() would otherwise re-arm the loop right after.
    if (!destroyed && visible && !document.hidden && raf === 0) {
      raf = requestAnimationFrame(frame);
    }
  };

  const update = () => {
    if (visible && !document.hidden) {
      last = 0;
      schedule();
    } else if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      update();
    },
    { threshold: 0.15 },
  );
  io.observe(section);
  document.addEventListener('visibilitychange', update);

  return {
    destroy() {
      destroyed = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
      if (raf !== 0) cancelAnimationFrame(raf);
    },
  };
}
