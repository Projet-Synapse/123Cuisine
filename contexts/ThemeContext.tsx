//////////////////////////////////////////////////////////////////////////
//                         🖼️ ThemeContext.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Moteur d'apparence de l'application : mode clair/sombre, couleur principale
 * (préréglée ou libre), teinte de fond, police, taille du texte et arrondi des
 * cartes. Toute la palette est *dérivée* d'une seule couleur de base par calcul
 * TSL, ce qui permet à l'utilisateur de choisir n'importe quelle couleur.
 *
 * Les réglages sont persistés en local (AsyncStorage) ; la synchronisation avec
 * le compte Supabase est assurée à part par components/AppearanceSync.tsx, car
 * ce provider est monté au-dessus de AuthProvider (pour que l'écran de login
 * soit lui aussi thémé) et ne peut donc pas lire l'utilisateur.
 *
 * SOMMAIRE
 * Chap 1. Types et réglages par défaut
 * Chap 2. Préréglages de couleurs et teintes de fond
 * Chap 3. Construction de la palette
 * Chap 4. Tokens de mise en forme (espacements, arrondis, typographie)
 * Chap 5. Provider
 */

import React, { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { Platform, TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
// Imports par variante et non depuis la racine du paquet : l'index de
// @expo-google-fonts/inter fait un require() de ses 18 variantes, que Metro ne
// sait pas élaguer — le bundle web embarquait 9,6 Mo de polices au lieu de 1,4.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Spacing as BaseSpacing, Radius as BaseRadius, FontSize as BaseFontSize, FontWeight } from '@/constants/theme';
import { bestTextOn, darken, ensureMaxLightness, ensureMinLightness, lighten, mix, normalizeHex } from '@/utils/color';

/////////////////////////////// Chap 1. Types ///////////////////////////////

export type ThemeMode = 'system' | 'light' | 'dark';
export type PrimaryColorKey =
  'terracotta' | 'sage' | 'ocean' | 'berry' | 'amber' | 'slate' | 'rose' | 'emerald' | 'custom';
export type BackgroundTint = 'warm' | 'neutral' | 'cool' | 'accent';
export type FontFamilyKey = 'system' | 'inter' | 'serif' | 'mono';
export type FontSizeKey = 'small' | 'medium' | 'large' | 'xlarge';
export type RadiusKey = 'sharp' | 'soft' | 'round';

export interface ThemeSettings {
  mode: ThemeMode;
  primaryColor: PrimaryColorKey;
  /** Couleur libre au format `#RRGGBB`, utilisée quand primaryColor === 'custom'. */
  customPrimary: string;
  backgroundTint: BackgroundTint;
  fontFamily: FontFamilyKey;
  fontSize: FontSizeKey;
  radius: RadiusKey;
  /** Horodatage ISO du dernier changement : arbitre la synchronisation multi-appareils. */
  updatedAt: string;
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'system',
  primaryColor: 'terracotta',
  customPrimary: '#C0392B',
  backgroundTint: 'warm',
  fontFamily: 'system',
  fontSize: 'medium',
  radius: 'soft',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const STORAGE_KEY = '@kitchen_theme_settings';

/////////////////////////////// Chap 2. Préréglages ///////////////////////////////

/*
 * Une seule couleur de base par préréglage : les variantes claires/sombres sont
 * calculées (cf. Chap 3). C'est ce qui remplace l'ancienne table
 * { value, dark, light } et son patch manuel sur « rose ».
 */
export const PRIMARY_PRESETS: Record<Exclude<PrimaryColorKey, 'custom'>, { label: string; base: string }> = {
  terracotta: { label: 'Terracotta', base: '#C0392B' },
  sage: { label: 'Sauge', base: '#27AE60' },
  ocean: { label: 'Océan', base: '#2980B9' },
  berry: { label: 'Baie', base: '#8E44AD' },
  amber: { label: 'Ambre', base: '#D68910' },
  slate: { label: 'Ardoise', base: '#2C3E50' },
  rose: { label: 'Rose', base: '#D81B60' },
  emerald: { label: 'Émeraude', base: '#1A8A6A' },
};

export const BACKGROUND_TINTS: { key: BackgroundTint; label: string; hint: string }[] = [
  { key: 'warm', label: 'Chaud', hint: 'Crème et terre cuite' },
  { key: 'neutral', label: 'Neutre', hint: 'Gris pur' },
  { key: 'cool', label: 'Froid', hint: 'Bleuté' },
  { key: 'accent', label: 'Ma couleur', hint: 'Teinté par ton accent' },
];

/** Palettes de fond : les valeurs « warm » sont celles historiques de l'app. */
const SURFACE_TINTS = {
  light: {
    warm: {
      background: '#FDF8F0',
      surface: '#FFFFFF',
      surfaceWarm: '#FEF9F2',
      surfaceMuted: '#F5EDE0',
      text: '#2C1810',
      textSubtle: '#8B6B5D',
      textMuted: '#B8A090',
      border: '#E8D5C4',
      borderLight: '#F0E4D6',
      overlay: 'rgba(44, 24, 16, 0.5)',
      shadow: 'rgba(44, 24, 16, 0.12)',
    },
    neutral: {
      background: '#F7F7F8',
      surface: '#FFFFFF',
      surfaceWarm: '#FBFBFC',
      surfaceMuted: '#EFEFF1',
      text: '#1C1C1E',
      textSubtle: '#6E6E73',
      textMuted: '#A0A0A6',
      border: '#DFDFE3',
      borderLight: '#EDEDF0',
      overlay: 'rgba(0, 0, 0, 0.45)',
      shadow: 'rgba(0, 0, 0, 0.10)',
    },
    cool: {
      background: '#F4F7FA',
      surface: '#FFFFFF',
      surfaceWarm: '#F9FBFD',
      surfaceMuted: '#E9EFF5',
      text: '#16222E',
      textSubtle: '#5B6B7A',
      textMuted: '#95A3B0',
      border: '#D6E0EA',
      borderLight: '#E6EDF3',
      overlay: 'rgba(22, 34, 46, 0.5)',
      shadow: 'rgba(22, 34, 46, 0.12)',
    },
  },
  dark: {
    warm: {
      background: '#121212',
      surface: '#1E1E1E',
      surfaceWarm: '#242424',
      surfaceMuted: '#2A2A2A',
      text: '#F0EAE0',
      textSubtle: '#C0B0A0',
      textMuted: '#888070',
      border: '#3A3530',
      borderLight: '#302A26',
      overlay: 'rgba(0, 0, 0, 0.6)',
      shadow: 'rgba(0, 0, 0, 0.4)',
    },
    neutral: {
      background: '#111113',
      surface: '#1B1B1E',
      surfaceWarm: '#212125',
      surfaceMuted: '#27272B',
      text: '#ECECEE',
      textSubtle: '#A8A8B0',
      textMuted: '#76767E',
      border: '#34343A',
      borderLight: '#2A2A2F',
      overlay: 'rgba(0, 0, 0, 0.6)',
      shadow: 'rgba(0, 0, 0, 0.4)',
    },
    cool: {
      background: '#0F1418',
      surface: '#181F25',
      surfaceWarm: '#1D252C',
      surfaceMuted: '#232C34',
      text: '#E6EDF3',
      textSubtle: '#9FB0BF',
      textMuted: '#6E8090',
      border: '#2C3742',
      borderLight: '#232C34',
      overlay: 'rgba(0, 0, 0, 0.6)',
      shadow: 'rgba(0, 0, 0, 0.45)',
    },
  },
} as const;

/////////////////////////////// Chap 3. Palette ///////////////////////////////

/** Couleur de base retenue pour les réglages donnés (préréglage ou couleur libre). */
export function resolveBaseColor(settings: ThemeSettings): string {
  if (settings.primaryColor === 'custom') {
    return normalizeHex(settings.customPrimary) ?? DEFAULT_SETTINGS.customPrimary;
  }
  return PRIMARY_PRESETS[settings.primaryColor]?.base ?? DEFAULT_SETTINGS.customPrimary;
}

export function buildColors(isDark: boolean, baseColor: string, tint: BackgroundTint) {
  // En sombre on remonte la luminosité (sinon un accent foncé disparaît sur le
  // fond) ; en clair on la plafonne (sinon le texte blanc des boutons saute).
  const primary = isDark ? ensureMinLightness(baseColor, 56) : ensureMaxLightness(baseColor, 62);
  const primaryLight = lighten(primary, 12);
  const primaryDark = darken(primary, 12);

  const scheme = isDark ? SURFACE_TINTS.dark : SURFACE_TINTS.light;
  const surfaces = tint === 'accent' ? scheme.neutral : scheme[tint];

  // Teinte « Ma couleur » : on infuse une pointe d'accent dans les fonds neutres.
  const infuse = (hex: string, ratio: number) => (tint === 'accent' ? mix(hex, primary, ratio) : hex);

  return {
    primary,
    primaryLight,
    primaryDark,
    secondary: isDark ? '#2ECC71' : '#27AE60',
    secondaryLight: isDark ? '#3DDC81' : '#2ECC71',
    accent: isDark ? '#F39C12' : '#E67E22',
    accentLight: isDark ? '#F8B940' : '#F39C12',

    background: infuse(surfaces.background, isDark ? 0.06 : 0.05),
    surface: infuse(surfaces.surface, isDark ? 0.05 : 0.02),
    surfaceWarm: infuse(surfaces.surfaceWarm, isDark ? 0.07 : 0.04),
    surfaceMuted: infuse(surfaces.surfaceMuted, isDark ? 0.09 : 0.08),

    text: surfaces.text,
    textSubtle: surfaces.textSubtle,
    textMuted: surfaces.textMuted,
    /* Bascule automatiquement en foncé sur un accent clair (ambre, jaune…). */
    textOnPrimary: bestTextOn(primary),

    border: infuse(surfaces.border, isDark ? 0.1 : 0.08),
    borderLight: infuse(surfaces.borderLight, isDark ? 0.08 : 0.05),

    success: isDark ? '#2ECC71' : '#27AE60',
    warning: isDark ? '#F39C12' : '#F39C12',
    error: isDark ? '#E74C3C' : '#E74C3C',
    info: isDark ? '#3498DB' : '#2980B9',

    /* Couleurs sémantiques, auparavant codées en dur dans chaque écran. */
    favorite: isDark ? '#FF8080' : '#FF6B6B',
    star: isDark ? '#FFB84D' : '#F5A623',
    difficulty: isDark
      ? {
          Facile: { bg: '#1B3A1F', fg: '#7BD48A' },
          Moyen: { bg: '#3E2C12', fg: '#F0B657' },
          Difficile: { bg: '#3E1A1D', fg: '#F08A8A' },
        }
      : {
          Facile: { bg: '#E8F5E9', fg: '#2E7D32' },
          Moyen: { bg: '#FFF3E0', fg: '#E65100' },
          Difficile: { bg: '#FFEBEE', fg: '#C62828' },
        },
    price: isDark
      ? { low: '#66D46A', mid: '#FFA640', high: '#C264D6' }
      : { low: '#4CAF50', mid: '#F57C00', high: '#9C27B0' },

    /* Couleurs de marque : jamais dérivées du thème. */
    supermarkets: {
      leclerc: '#0066CC',
      intermarche: '#D62B27',
      carrefour: '#003087',
      lidl: '#0050AA',
      aldi: '#00A0E3',
      monoprix: '#E30613',
      casino: '#D62B27',
      superu: '#E2001A',
      autre: isDark ? '#888888' : '#666666',
    },

    overlay: surfaces.overlay,
    shadow: surfaces.shadow,
  };
}

export type AppColors = ReturnType<typeof buildColors>;

/////////////////////////////// Chap 4. Tokens ///////////////////////////////

const FONT_SCALES: Record<FontSizeKey, number> = {
  small: 0.9,
  medium: 1,
  large: 1.12,
  xlarge: 1.25,
};

const RADIUS_SCALES: Record<RadiusKey, number> = {
  sharp: 0.35,
  soft: 1,
  round: 1.6,
};

export const FONT_FAMILY_OPTIONS: { key: FontFamilyKey; label: string; hint: string }[] = [
  { key: 'system', label: 'Système', hint: "Celle de l'appareil" },
  { key: 'inter', label: 'Inter', hint: 'Moderne, très lisible' },
  { key: 'serif', label: 'Serif', hint: 'Classique, livre de cuisine' },
  { key: 'mono', label: 'Mono', hint: 'Chasse fixe' },
];

export const FONT_SIZE_OPTIONS: { key: FontSizeKey; label: string }[] = [
  { key: 'small', label: 'Petit' },
  { key: 'medium', label: 'Normal' },
  { key: 'large', label: 'Grand' },
  { key: 'xlarge', label: 'Très grand' },
];

export const RADIUS_OPTIONS: { key: RadiusKey; label: string; hint: string }[] = [
  { key: 'sharp', label: 'Net', hint: 'Coins presque droits' },
  { key: 'soft', label: 'Doux', hint: 'Arrondi classique' },
  { key: 'round', label: 'Rond', hint: 'Très arrondi' },
];

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
}) as string;

const MONO_FAMILY = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
}) as string;

type WeightKey = keyof typeof FontWeight;

interface FontChoice {
  /** Famille par graisse. `undefined` = police système. */
  families: Record<WeightKey, string | undefined>;
  /** true quand la graisse est intégrée à la police (Inter) : on n'ajoute alors pas fontWeight. */
  weightsBakedIn: boolean;
}

function resolveFonts(key: FontFamilyKey, interLoaded: boolean): FontChoice {
  if (key === 'inter' && interLoaded) {
    return {
      families: {
        regular: 'Inter_400Regular',
        medium: 'Inter_500Medium',
        semibold: 'Inter_600SemiBold',
        bold: 'Inter_700Bold',
      },
      weightsBakedIn: true,
    };
  }
  const single = key === 'serif' ? SERIF_FAMILY : key === 'mono' ? MONO_FAMILY : undefined;
  return {
    families: { regular: single, medium: single, semibold: single, bold: single },
    weightsBakedIn: false,
  };
}

export interface AppTokens {
  Colors: AppColors;
  Spacing: typeof BaseSpacing;
  Radius: typeof BaseRadius;
  FontSize: typeof BaseFontSize;
  FontWeight: typeof FontWeight;
  Shadow: { sm: object; md: object; lg: object };
  /** Famille de la graisse « regular » — pratique pour un TextInput ou un placeholder. */
  fontFamily: string | undefined;
  /**
   * Famille correspondant à une graisse CSS donnée. Sert au <Text> thémé
   * (components/Themed.tsx) : avec Inter, chaque graisse est une police
   * distincte, il ne suffit pas de poser fontWeight.
   */
  fontFor: (weight?: TextStyle['fontWeight']) => string | undefined;
  /**
   * Style de texte complet (taille mise à l'échelle + graisse + famille).
   * À utiliser via l'étalement : `...t.typo('md', 'bold')`.
   */
  typo: (size: keyof typeof BaseFontSize | number, weight?: WeightKey) => TextStyle;
}

function buildTokens(
  Colors: AppColors,
  fontSizeKey: FontSizeKey,
  radiusKey: RadiusKey,
  fontFamilyKey: FontFamilyKey,
  interLoaded: boolean,
): AppTokens {
  const fontScale = FONT_SCALES[fontSizeKey];
  const radiusScale = RADIUS_SCALES[radiusKey];

  const FontSize = Object.fromEntries(
    Object.entries(BaseFontSize).map(([k, v]) => [k, Math.round(v * fontScale)]),
  ) as typeof BaseFontSize;

  const Radius = {
    ...Object.fromEntries(
      Object.entries(BaseRadius)
        .filter(([k]) => k !== 'round')
        .map(([k, v]) => [k, Math.round(v * radiusScale)]),
    ),
    round: BaseRadius.round, // les pastilles restent des pastilles
  } as typeof BaseRadius;

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 8,
    },
  };

  const fonts = resolveFonts(fontFamilyKey, interLoaded);

  const typo = (size: keyof typeof BaseFontSize | number, weight: WeightKey = 'regular'): TextStyle => {
    const fontSize = typeof size === 'number' ? Math.round(size * fontScale) : FontSize[size];
    const family = fonts.families[weight];
    if (fonts.weightsBakedIn && family) return { fontSize, fontFamily: family };
    return { fontSize, fontWeight: FontWeight[weight], ...(family ? { fontFamily: family } : {}) };
  };

  const fontFor = (weight?: TextStyle['fontWeight']): string | undefined => {
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
      return fonts.families.bold;
    }
    if (weight === '600') return fonts.families.semibold;
    if (weight === '500') return fonts.families.medium;
    return fonts.families.regular;
  };

  return {
    Colors,
    Spacing: BaseSpacing,
    Radius,
    FontSize,
    FontWeight,
    Shadow,
    fontFamily: fonts.families.regular,
    fontFor,
    typo,
  };
}

/////////////////////////////// Chap 5. Provider ///////////////////////////////

export interface ThemeContextType extends AppTokens {
  settings: ThemeSettings;
  isDark: boolean;
  presets: typeof PRIMARY_PRESETS;
  /** Couleur de base retenue (préréglage ou couleur libre), avant adaptation au mode. */
  baseColor: string;
  updateSettings: (partial: Partial<ThemeSettings>) => Promise<void>;
  /** Applique des réglages venus du compte sans réécrire `updatedAt` (cf. AppearanceSync). */
  applySettings: (next: ThemeSettings) => Promise<void>;
  resetAppearance: () => Promise<void>;
  /** Réglages chargés depuis le stockage local : évite d'écraser le compte au démarrage. */
  hydrated: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function sanitize(raw: unknown): ThemeSettings {
  const parsed = (raw ?? {}) as Partial<ThemeSettings>;
  const merged = { ...DEFAULT_SETTINGS, ...parsed };
  if (merged.primaryColor !== 'custom' && !PRIMARY_PRESETS[merged.primaryColor]) {
    merged.primaryColor = DEFAULT_SETTINGS.primaryColor;
  }
  merged.customPrimary = normalizeHex(merged.customPrimary) ?? DEFAULT_SETTINGS.customPrimary;
  if (!FONT_SCALES[merged.fontSize]) merged.fontSize = DEFAULT_SETTINGS.fontSize;
  if (!RADIUS_SCALES[merged.radius]) merged.radius = DEFAULT_SETTINGS.radius;
  if (!SURFACE_TINTS.light[merged.backgroundTint as 'warm'] && merged.backgroundTint !== 'accent') {
    merged.backgroundTint = DEFAULT_SETTINGS.backgroundTint;
  }
  return merged;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const settingsRef = useRef(settings);

  // Inter est embarquée dans le bundle : le chargement ne bloque pas le rendu,
  // on retombe simplement sur la police système tant qu'il n'est pas terminé.
  const [interLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (cancelled) return;
        if (raw) {
          try {
            const next = sanitize(JSON.parse(raw));
            settingsRef.current = next;
            setSettings(next);
          } catch {
            /* stockage corrompu : on garde les valeurs par défaut */
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const isDark = settings.mode === 'dark' ? true : settings.mode === 'light' ? false : systemScheme === 'dark';

  const baseColor = useMemo(() => resolveBaseColor(settings), [settings]);

  const Colors = useMemo(
    () => buildColors(isDark, baseColor, settings.backgroundTint),
    [isDark, baseColor, settings.backgroundTint],
  );

  const tokens = useMemo(
    () => buildTokens(Colors, settings.fontSize, settings.radius, settings.fontFamily, interLoaded),
    [Colors, settings.fontSize, settings.radius, settings.fontFamily, interLoaded],
  );

  const persist = useCallback(async (next: ThemeSettings) => {
    settingsRef.current = next;
    setSettings(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible : le réglage reste actif pour la session */
    }
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<ThemeSettings>) => {
      await persist(sanitize({ ...settingsRef.current, ...partial, updatedAt: new Date().toISOString() }));
    },
    [persist],
  );

  const applySettings = useCallback(
    async (next: ThemeSettings) => {
      await persist(sanitize(next));
    },
    [persist],
  );

  const resetAppearance = useCallback(async () => {
    await persist({ ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() });
  }, [persist]);

  // Web : garde la barre du navigateur (et la PWA) en accord avec le thème.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', Colors.primary);
    if (document.body) document.body.style.backgroundColor = Colors.background;
  }, [Colors.primary, Colors.background]);

  const value = useMemo<ThemeContextType>(
    () => ({
      ...tokens,
      settings,
      isDark,
      presets: PRIMARY_PRESETS,
      baseColor,
      updateSettings,
      applySettings,
      resetAppearance,
      hydrated,
    }),
    [tokens, settings, isDark, baseColor, updateSettings, applySettings, resetAppearance, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
