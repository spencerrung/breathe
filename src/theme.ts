export interface Theme {
  id: string;
  label: string;
  /** Linear-ish RGB in 0..1, consumed by the renderer (bg = clear color). */
  bg: [number, number, number];
  inner: [number, number, number];
  outer: [number, number, number];
}

// The CSS side of each theme lives in styles/main.css under [data-theme=…].
// These triples are the same palette for the canvas — 9 numbers per theme is
// cheaper than parsing getComputedStyle at runtime.
export const THEMES: Theme[] = [
  {
    id: 'twilight',
    label: 'Twilight',
    bg: [0.039, 0.039, 0.078],
    inner: [0.765, 0.694, 1.0],
    outer: [0.24, 0.17, 0.55],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    bg: [0.024, 0.071, 0.094],
    inner: [0.56, 0.96, 0.89],
    outer: [0.02, 0.32, 0.42],
  },
  {
    id: 'dawn',
    label: 'Dawn',
    bg: [0.094, 0.051, 0.071],
    inner: [1.0, 0.79, 0.64],
    outer: [0.62, 0.2, 0.28],
  },
];

export function applyTheme(id: string): Theme {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  return theme;
}
