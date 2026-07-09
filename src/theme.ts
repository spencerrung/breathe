export interface Theme {
  id: string;
  label: string;
  /** Linear-ish RGB in 0..1, consumed by the renderer (bg = clear color). */
  bg: [number, number, number];
  /** Resting palette — what the orb settles into at the end of an exhale. */
  inner: [number, number, number];
  outer: [number, number, number];
  /** Full-inhale palette; the renderer crossfades with the breath value so
      color itself signals inhale vs exhale, not just size. */
  innerHi: [number, number, number];
  outerHi: [number, number, number];
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
    innerHi: [0.94, 0.73, 0.99], // violet warms toward rose-lavender
    outerHi: [0.45, 0.2, 0.63],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    bg: [0.024, 0.071, 0.094],
    inner: [0.56, 0.96, 0.89],
    outer: [0.02, 0.32, 0.42],
    innerHi: [0.68, 1.0, 0.78], // teal brightens toward sunlit aqua-green
    outerHi: [0.04, 0.44, 0.36],
  },
  {
    id: 'dawn',
    label: 'Dawn',
    bg: [0.094, 0.051, 0.071],
    inner: [1.0, 0.79, 0.64],
    outer: [0.62, 0.2, 0.28],
    innerHi: [1.0, 0.9, 0.53], // peach warms toward gold
    outerHi: [0.8, 0.36, 0.17],
  },
  {
    id: 'bluey',
    label: 'Bluey',
    bg: [0.063, 0.11, 0.22],
    inner: [0.66, 0.86, 1.0],
    outer: [0.15, 0.35, 0.7],
    innerHi: [1.0, 0.8, 0.55], // heeler blue warms toward Bingo orange
    outerHi: [0.78, 0.42, 0.22],
  },
];

export function applyTheme(id: string): Theme {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  return theme;
}
