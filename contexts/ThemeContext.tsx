// Powered by OnSpace.AI
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type PrimaryColorKey =
  | 'terracotta'
  | 'sage'
  | 'ocean'
  | 'berry'
  | 'amber'
  | 'slate'
  | 'rose'
  | 'emerald';

export interface ThemeSettings {
  mode: ThemeMode;
  primaryColor: PrimaryColorKey;
  fontSize: 'small' | 'medium' | 'large';
}

const PRIMARY_COLORS: Record<PrimaryColorKey, { label: string; value: string; dark: string; light: string }> = {
  terracotta: { label: 'Terracotta', value: '#C0392B', dark: '#E05A44', light: '#E07060' },
  sage:       { label: 'Sauge',      value: '#27AE60', dark: '#2ECC71', light: '#3DBE72' },
  ocean:      { label: 'Océan',      value: '#2980B9', dark: '#3498DB', light: '#4AA8E0' },
  berry:      { label: 'Baie',       value: '#8E44AD', dark: '#9B59B6', light: '#A86CC1' },
  amber:      { label: 'Ambre',      value: '#D68910', dark: '#E8A020', light: '#F0B030' },
  slate:      { label: 'Ardoise',    value: '#2C3E50', dark: '#4A6A8A', light: '#5A7A9A' },
  rose:       { label: 'Rose',       value: '#C0392B', dark: '#E91E63', light: '#EC407A' },
  emerald:    { label: 'Émeraude',   value: '#1A8A6A', dark: '#26C17A', light: '#30D18A' },
};

// Override rose to be actually pink
PRIMARY_COLORS.rose = { label: 'Rose', value: '#D81B60', dark: '#E91E63', light: '#EC407A' };

export function buildColors(isDark: boolean, primaryKey: PrimaryColorKey) {
  const primary = isDark ? PRIMARY_COLORS[primaryKey].dark : PRIMARY_COLORS[primaryKey].value;
  const primaryLight = PRIMARY_COLORS[primaryKey].light;
  const primaryDark = PRIMARY_COLORS[primaryKey].value;

  if (isDark) {
    return {
      primary,
      primaryLight,
      primaryDark,
      secondary: '#2ECC71',
      secondaryLight: '#3DDC81',
      accent: '#F39C12',
      accentLight: '#F8B940',

      background: '#121212',
      surface: '#1E1E1E',
      surfaceWarm: '#242424',
      surfaceMuted: '#2A2A2A',

      text: '#F0EAE0',
      textSubtle: '#C0B0A0',
      textMuted: '#888070',
      textOnPrimary: '#FFFFFF',

      border: '#3A3530',
      borderLight: '#302A26',

      success: '#2ECC71',
      warning: '#F39C12',
      error: '#E74C3C',
      info: '#3498DB',

      supermarkets: {
        leclerc: '#0066CC',
        intermarche: '#D62B27',
        carrefour: '#003087',
        lidl: '#0050AA',
        aldi: '#00A0E3',
        monoprix: '#E30613',
        casino: '#D62B27',
        superu: '#E2001A',
        autre: '#888888',
      },

      overlay: 'rgba(0, 0, 0, 0.6)',
      shadow: 'rgba(0, 0, 0, 0.4)',
    };
  }

  return {
    primary,
    primaryLight,
    primaryDark,
    secondary: '#27AE60',
    secondaryLight: '#2ECC71',
    accent: '#E67E22',
    accentLight: '#F39C12',

    background: '#FDF8F0',
    surface: '#FFFFFF',
    surfaceWarm: '#FEF9F2',
    surfaceMuted: '#F5EDE0',

    text: '#2C1810',
    textSubtle: '#8B6B5D',
    textMuted: '#B8A090',
    textOnPrimary: '#FFFFFF',

    border: '#E8D5C4',
    borderLight: '#F0E4D6',

    success: '#27AE60',
    warning: '#F39C12',
    error: '#E74C3C',
    info: '#2980B9',

    supermarkets: {
      leclerc: '#0066CC',
      intermarche: '#D62B27',
      carrefour: '#003087',
      lidl: '#0050AA',
      aldi: '#00A0E3',
      monoprix: '#E30613',
      casino: '#D62B27',
      superu: '#E2001A',
      autre: '#666666',
    },

    overlay: 'rgba(44, 24, 16, 0.5)',
    shadow: 'rgba(44, 24, 16, 0.12)',
  };
}

export type AppColors = ReturnType<typeof buildColors>;

export interface ThemeContextType {
  settings: ThemeSettings;
  isDark: boolean;
  Colors: AppColors;
  primaryColors: typeof PRIMARY_COLORS;
  updateSettings: (s: Partial<ThemeSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'system',
  primaryColor: 'terracotta',
  fontSize: 'medium',
};

const STORAGE_KEY = '@kitchen_theme_settings';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const isDark =
    settings.mode === 'dark'
      ? true
      : settings.mode === 'light'
      ? false
      : systemScheme === 'dark';

  const Colors = buildColors(isDark, settings.primaryColor);

  const updateSettings = useCallback(async (partial: Partial<ThemeSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [settings]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ settings, isDark, Colors, primaryColors: PRIMARY_COLORS, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export { PRIMARY_COLORS };
