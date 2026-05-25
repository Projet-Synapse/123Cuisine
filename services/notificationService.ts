// Powered by OnSpace.AI
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Recipe } from '@/services/kitchenService';

export interface NotificationSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'never';
  time: { hour: number; minute: number };
  notifyFavorites: boolean;
  notifyNewIdeas: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  frequency: 'daily',
  time: { hour: 12, minute: 0 },
  notifyFavorites: true,
  notifyNewIdeas: true,
};

const STORAGE_KEY = '@kitchen_notification_settings';

const getNotifications = async () => {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.default.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return Notifications.default;
  } catch {
    return null;
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const cancelAllNotifications = async (): Promise<void> => {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
};

const RECIPE_SUGGESTIONS = [
  { title: '🍽️ Idée repas du jour', body: 'Avez-vous pensé à cuisiner une ratatouille ce soir ?' },
  { title: '👨‍🍳 Inspiration cuisine', body: 'Découvrez une nouvelle recette adaptée à vos préférences !' },
  { title: '🛒 Préparez vos courses', body: 'N\'oubliez pas de préparer votre liste de courses !' },
  { title: '❤️ Recette coup de cœur', body: 'Revisitez l\'une de vos recettes favorites ce soir.' },
  { title: '🌿 Cuisine saine', body: 'Essayez une recette végétarienne aujourd\'hui pour varier !' },
  { title: '⏱️ Recette express', body: 'Pas beaucoup de temps ? Trouvez une recette rapide dans l\'app.' },
];

export const scheduleRecommendationNotifications = async (
  settings: NotificationSettings,
  recipes: Recipe[]
): Promise<void> => {
  if (Platform.OS === 'web') return;
  await cancelAllNotifications();
  if (!settings.enabled || settings.frequency === 'never') return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const favoriteRecipes = recipes.filter(r => r.isFavorite);
  const count = settings.frequency === 'daily' ? 7 : 4;

  try {
    for (let i = 0; i < count; i++) {
      const daysAhead = settings.frequency === 'daily' ? i : i * 7;
      const trigger = new Date();
      trigger.setDate(trigger.getDate() + daysAhead + 1);
      trigger.setHours(settings.time.hour, settings.time.minute, 0, 0);

      let notif = RECIPE_SUGGESTIONS[i % RECIPE_SUGGESTIONS.length];

      if (settings.notifyFavorites && favoriteRecipes.length > 0 && Math.random() > 0.5) {
        const recipe = favoriteRecipes[Math.floor(Math.random() * favoriteRecipes.length)];
        notif = {
          title: 'Recette coup de coeur',
          body: `Que diriez-vous de "${recipe.title}" ce soir ?`,
        };
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    }
  } catch {}
};
