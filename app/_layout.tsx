//////////////////////////////////////////////////////////////////////////
//                            🏗️ _Layout.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Layout racine de l'app : fournisseurs de contexte (thème, auth, cuisine,
 * alertes), synchronisation de l'apparence avec le compte, filet de sécurité
 * ErrorBoundary, et bandeau de mise à jour desktop.
 *
 * Ordre des fournisseurs : ThemeProvider est volontairement AU-DESSUS de
 * AuthProvider pour que l'écran de connexion soit thémé lui aussi. La
 * synchronisation apparence <-> compte est donc déléguée à <AppearanceSync />,
 * monté sous AuthProvider.
 *
 * Les écrans ne sont pas déclarés un par un : expo-router les découvre depuis
 * l'arborescence de fichiers, et aucun n'a d'option propre (headerShown est
 * réglé globalement ci-dessous).
 */

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { KitchenProvider } from '@/contexts/KitchenContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateBanner } from '@/components/UpdateBanner';
import { AppearanceSync } from '@/components/AppearanceSync';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AlertProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppearanceSync />
              <KitchenProvider>
                <View style={{ flex: 1 }}>
                  <UpdateBanner />
                  <Stack screenOptions={{ headerShown: false }} />
                </View>
              </KitchenProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </AlertProvider>
    </ErrorBoundary>
  );
}
