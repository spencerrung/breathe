export type ScreenName = 'home' | 'custom' | 'session' | 'complete';

const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')];

export function showScreen(name: ScreenName): void {
  for (const s of screens) s.classList.toggle('active', s.dataset.screen === name);
  // Only browsable screens get a hash — a session must be started deliberately.
  if (name === 'home' || name === 'custom') {
    history.replaceState(null, '', name === 'home' ? '#' : `#${name}`);
  }
}

export function currentScreen(): ScreenName {
  return (screens.find((s) => s.classList.contains('active'))?.dataset.screen ??
    'home') as ScreenName;
}
