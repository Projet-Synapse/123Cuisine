//////////////////////////////////////////////////////////////////////////
//                              Index.tsx                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Point d'entrée racine : redirige vers les onglets (AuthRouter gère l'accès invité ou la redirection vers /login).
 */

import { AuthRouter } from '@/template';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  return (
    <AuthRouter loginRoute="/login" excludeRoutes={[]}>
      <Redirect href="/(tabs)" />
    </AuthRouter>
  );
}
