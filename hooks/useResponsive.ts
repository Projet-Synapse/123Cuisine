//////////////////////////////////////////////////////////////////////////
//                           UseResponsive.ts                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Détecte la largeur d'écran et le nombre de colonnes à afficher selon les points de rupture (mobile/tablette/desktop large).
 */

// Powered by OnSpace.AI
import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '@/constants/layout';

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isRegular = width >= Breakpoints.compact;
  const isWide = width >= Breakpoints.regular;

  return {
    width,
    isRegular,
    isWide,
    columns: isWide ? 3 : isRegular ? 2 : 1,
  };
}
