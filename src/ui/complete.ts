import { showScreen } from './screens';
import type { SessionSummary } from './session';

export interface CompleteDeps {
  onAgain(): void;
  onDone(): void;
}

export function setupComplete(deps: CompleteDeps): { show(summary: SessionSummary): void } {
  const summaryEl = document.getElementById('complete-summary')!;
  document.getElementById('btn-again')!.addEventListener('click', deps.onAgain);
  document.getElementById('btn-done')!.addEventListener('click', deps.onDone);

  return {
    show(summary) {
      const mins =
        summary.minutes === Infinity
          ? `${Math.max(1, Math.round(summary.elapsedSeconds / 60))} min`
          : `${summary.minutes} min`;
      const breaths = `${summary.cycles} breath${summary.cycles === 1 ? '' : 's'}`;
      summaryEl.textContent = `${summary.technique.name} · ${mins} · ${breaths}`;
      showScreen('complete');
    },
  };
}
