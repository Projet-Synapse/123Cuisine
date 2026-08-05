//////////////////////////////////////////////////////////////////////////
//                           UseThemeColor.ts                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Hook du boilerplate Expo Router associé à Colors.ts ; l'app utilise plutôt useAppTheme/ThemeContext, laissé pour compatibilité avec +not-found.tsx.
 */

/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
