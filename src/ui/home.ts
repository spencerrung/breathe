import { PRESETS, buildCustomTechnique, type Technique } from '../breath/presets';
import { THEMES, applyTheme, type Theme } from '../theme';
import type { Settings } from '../settings';
import { makeDurationChips } from './durations';
import { showScreen } from './screens';

export interface HomeDeps {
  settings: Settings;
  save(): void;
  onStart(technique: Technique, minutes: number): void;
  onTheme(theme: Theme): void;
}

export function setupHome(deps: HomeDeps): void {
  const { settings } = deps;
  const cardsEl = document.getElementById('technique-cards')!;

  // ---- duration bottom sheet ----
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.hidden = true;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `
    <h3 class="sheet-title"></h3>
    <p class="sheet-pattern"></p>
    <div class="duration-row" role="group" aria-label="Session length"></div>
    <button type="button" class="begin-btn sheet-begin">Begin</button>
  `;
  backdrop.append(sheet);
  document.querySelector('[data-screen="home"]')!.append(backdrop);

  const sheetTitle = sheet.querySelector<HTMLElement>('.sheet-title')!;
  const sheetPattern = sheet.querySelector<HTMLElement>('.sheet-pattern')!;
  const sheetBegin = sheet.querySelector<HTMLButtonElement>('.sheet-begin')!;
  let sheetTechnique: Technique | null = null;

  const setChip = makeDurationChips(
    sheet.querySelector<HTMLElement>('.duration-row')!,
    settings.durationMin,
    (min) => {
      settings.durationMin = min;
      deps.save();
    },
  );

  const openSheet = (technique: Technique) => {
    sheetTechnique = technique;
    sheetTitle.textContent = technique.name;
    sheetPattern.textContent = technique.pattern;
    setChip(settings.durationMin);
    backdrop.hidden = false;
    sheetBegin.focus();
  };
  const closeSheet = () => {
    backdrop.hidden = true;
    sheetTechnique = null;
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.hidden) closeSheet();
  });
  sheetBegin.addEventListener('click', () => {
    if (!sheetTechnique) return;
    const technique = sheetTechnique;
    closeSheet();
    deps.onStart(technique, settings.durationMin === 0 ? Infinity : settings.durationMin);
  });

  // ---- technique cards ----
  const addCard = (technique: Technique | null) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = technique ? 'card' : 'card card-custom';
    const name = technique?.name ?? 'Your own pace';
    const pattern = technique?.pattern ?? buildCustomTechnique(settings.custom).pattern;
    const tagline = technique?.tagline ?? 'Set each count yourself.';
    card.innerHTML = `
      <span class="card-name"></span>
      <span class="card-pattern"></span>
      <span class="card-tagline"></span>
    `;
    card.querySelector('.card-name')!.textContent = name;
    card.querySelector('.card-pattern')!.textContent = pattern;
    card.querySelector('.card-tagline')!.textContent = tagline;
    card.addEventListener('click', () => {
      if (technique) {
        settings.lastTechnique = technique.id;
        deps.save();
        openSheet(technique);
      } else {
        showScreen('custom');
      }
    });
    cardsEl.append(card);
    return card;
  };

  for (const preset of PRESETS) addCard(preset);
  const customCard = addCard(null);

  // Keep the custom card's pattern fresh when the editor changes it.
  document.addEventListener('breathe:custom-changed', () => {
    customCard.querySelector('.card-pattern')!.textContent = buildCustomTechnique(
      settings.custom,
    ).pattern;
  });

  // ---- theme swatches ----
  const themeRow = document.getElementById('theme-row')!;
  const swatches = THEMES.map((theme) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-chip';
    b.setAttribute('aria-label', `${theme.label} theme`);
    const dot = document.createElement('span');
    dot.className = `theme-dot swatch-${theme.id}`;
    const label = document.createElement('span');
    label.textContent = theme.label;
    b.append(dot, label);
    b.addEventListener('click', () => {
      settings.theme = theme.id;
      deps.save();
      deps.onTheme(applyTheme(theme.id));
      setSwatch(theme.id);
    });
    themeRow.append(b);
    return { theme, b };
  });
  const setSwatch = (id: string) => {
    for (const { theme, b } of swatches) {
      b.setAttribute('aria-pressed', String(theme.id === id));
    }
  };
  setSwatch(settings.theme);

  // ---- large text ----
  const textToggle = document.getElementById('large-text-toggle')!;
  const applyLargeText = () => {
    document.documentElement.classList.toggle('large-text', settings.largeText);
    textToggle.setAttribute('aria-pressed', String(settings.largeText));
  };
  textToggle.addEventListener('click', () => {
    settings.largeText = !settings.largeText;
    deps.save();
    applyLargeText();
  });
  applyLargeText();
}
