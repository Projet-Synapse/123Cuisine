//////////////////////////////////////////////////////////////////////////
//                              🎨 Color.ts                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Manipulation de couleurs en TSL (teinte / saturation / luminosité) : sert à
 * dériver toute une palette à partir d'une seule couleur choisie par
 * l'utilisateur, et à garantir un texte lisible par-dessus.
 *
 * SOMMAIRE
 * Chap 1. Conversions hex <-> HSL
 * Chap 2. Transformations (éclaircir, assombrir, mélanger, saturer)
 * Chap 3. Lisibilité (luminance relative, meilleur texte par-dessus)
 */

/////////////////////////////// Chap 1. Conversions ///////////////////////////////

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/** Accepte `#RGB`, `#RRGGBB`, avec ou sans `#`. */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim());
}

/** Normalise vers la forme `#RRGGBB` en majuscules. Renvoie null si invalide. */
export function normalizeHex(hex: string): string | null {
  const raw = hex.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map(c => c + c)
          .join('')
      : raw;
  return `#${full.toUpperCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? '#000000';
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b]
    .map(v => clamp(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let rgb: [number, number, number];
  if (hn < 60) rgb = [c, x, 0];
  else if (hn < 120) rgb = [x, c, 0];
  else if (hn < 180) rgb = [0, c, x];
  else if (hn < 240) rgb = [0, x, c];
  else if (hn < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}

/////////////////////////////// Chap 2. Transformations ///////////////////////////////

/** Éclaircit de `amount` points de luminosité (0-100). */
export function lighten(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: Math.min(100, hsl.l + amount) });
}

/** Assombrit de `amount` points de luminosité (0-100). */
export function darken(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: Math.max(0, hsl.l - amount) });
}

/** Fait varier la saturation de `amount` points (négatif = désature). */
export function saturate(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, s: Math.max(0, Math.min(100, hsl.s + amount)) });
}

/** Mélange deux couleurs. `ratio` = part de `b` (0 → a, 1 → b). */
export function mix(a: string, b: string, ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.r + (cb.r - ca.r) * r, ca.g + (cb.g - ca.g) * r, ca.b + (cb.b - ca.b) * r);
}

/**
 * Force une luminosité minimale : indispensable en mode sombre, où un accent
 * très foncé choisi par l'utilisateur deviendrait invisible sur le fond #121212.
 */
export function ensureMinLightness(hex: string, minL: number): string {
  const hsl = hexToHsl(hex);
  return hsl.l >= minL ? (normalizeHex(hex) ?? hex) : hslToHex({ ...hsl, l: minL });
}

/** Force une luminosité maximale (symétrique, pour le mode clair). */
export function ensureMaxLightness(hex: string, maxL: number): string {
  const hsl = hexToHsl(hex);
  return hsl.l <= maxL ? (normalizeHex(hex) ?? hex) : hslToHex({ ...hsl, l: maxL });
}

/////////////////////////////// Chap 3. Lisibilité ///////////////////////////////

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Choisit la couleur de texte la plus lisible sur `background`.
 * C'est ce qui remplace les `'#fff'` en dur : sur un accent jaune ou ambre
 * clair, le texte bascule automatiquement en foncé.
 *
 * On ne prend pas bêtement le meilleur des deux : le blanc reste préféré tant
 * qu'il tient le seuil AA « grand texte / composant d'interface » (3:1), sinon
 * la moitié des accents foncés basculeraient en texte brun et l'app ne
 * ressemblerait plus à ce qu'elle est aujourd'hui.
 */
export function bestTextOn(background: string, dark = '#2C1810', light = '#FFFFFF'): string {
  return contrastRatio(background, light) >= 3.2 ? light : dark;
}
