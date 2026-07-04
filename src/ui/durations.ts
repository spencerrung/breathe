const CHOICES = [2, 5, 10, 20, 0]; // minutes; 0 = open-ended

export function formatDuration(minutes: number): string {
  return minutes === 0 ? '∞' : `${minutes} min`;
}

/** Renders duration chips into `container`; returns a setter for the active chip. */
export function makeDurationChips(
  container: HTMLElement,
  initial: number,
  onChange: (minutes: number) => void,
): (minutes: number) => void {
  container.textContent = '';
  const buttons = CHOICES.map((min) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = formatDuration(min);
    if (min === 0) b.setAttribute('aria-label', 'Open-ended session');
    b.addEventListener('click', () => {
      setActive(min);
      onChange(min);
    });
    container.append(b);
    return { min, b };
  });

  const setActive = (minutes: number) => {
    for (const { min, b } of buttons) b.classList.toggle('active', min === minutes);
  };
  setActive(initial);
  return setActive;
}
