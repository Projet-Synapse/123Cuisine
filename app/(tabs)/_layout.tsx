// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 62, android: insets.bottom + 62, default: 70 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: insets.bottom + 10, android: insets.bottom + 10, default: 8 }),
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recettes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="menu-book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="shopping-cart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="playlist-play" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: 'Préférences',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="tune" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
