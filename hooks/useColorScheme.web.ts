//////////////////////////////////////////////////////////////////////////
//                        UseColorScheme.web.ts                         //
//////////////////////////////////////////////////////////////////////////

/*
 * Variante web : attend l'hydratation côté client avant de renvoyer le vrai thème système, pour rester cohérent avec le rendu statique.
 */

import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
