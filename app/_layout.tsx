// Powered by OnSpace.AI
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { KitchenProvider } from '@/contexts/KitchenContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
        <AuthProvider>
          <KitchenProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen name="create-recipe" />
              <Stack.Screen name="create-list" />
              <Stack.Screen name="list/[id]" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="create-playlist" />
              <Stack.Screen name="playlist/[id]" />
              <Stack.Screen name="edit-recipe/[id]" />
              <Stack.Screen name="edit-playlist/[id]" />
              <Stack.Screen name="edit-list/[id]" />
            </Stack>
          </KitchenProvider>
        </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
