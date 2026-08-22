//////////////////////////////////////////////////////////////////////////
//                              Theme.ts                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Valeurs de BASE du système de design : espacements, arrondis, tailles de
 * police, graisses et ombres.
 *
 * ⚠️ Ces valeurs ne sont pas celles à utiliser directement dans un écran :
 * elles servent de socle à ThemeContext, qui les met à l'échelle selon les
 * réglages de l'utilisateur (taille du texte, arrondi) et les expose via
 * `useAppTheme()`. On n'importe ce fichier en direct que là où le contexte
 * n'est pas disponible — typiquement components/ErrorBoundary.tsx, qui doit
 * survivre à un plantage du contexte lui-même.
 */

export const Colors = {
  primary: '#C0392B',
  primaryLight: '#E74C3C',
  primaryDark: '#962D22',
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

  // Supermarket brand colors
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

/**
 * Palette d'accents proposée pour les objets créés par l'utilisateur
 * (couverture de playlist, groupe, avatar de repli). Indépendante du thème :
 * ce sont des couleurs de contenu, pas d'interface.
 */
export const ACCENT_SWATCHES = ['#C0705A', '#6B8F71', '#5E7A8A', '#D4824A', '#7E5A8A', '#3A8A72', '#B0405A', '#4A5EA0'];

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
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
