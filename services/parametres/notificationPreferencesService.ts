/**
 * notificationPreferencesService.ts
 * Gestion des préférences de notifications par catégorie (email).
 * Stockage en Supabase (user_preferences.notifications) pour les utilisateurs connectés.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';

export type NotificationRecurrence = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type NotificationCategory = 'activity' | 'recommendations' | 'weekly_menus';

export interface NotificationCategoryPreference {
  enabled: boolean;
  recurrence: NotificationRecurrence;
}

export interface NotificationPreferences {
  activity: NotificationCategoryPreference;
  recommendations: NotificationCategoryPreference;
  weekly_menus: NotificationCategoryPreference;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  activity: { enabled: false, recurrence: 'weekly' },
  recommendations: { enabled: false, recurrence: 'weekly' },
  weekly_menus: { enabled: false, recurrence: 'weekly' },
};

const LOCAL_KEY = '@kitchen_notification_prefs';

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('user_preferences')
      .select('notifications')
      .eq('id', userId)
      .single();
    if (!error && data?.notifications) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data.notifications as NotificationPreferences) };
    }
  } catch {}
  // Fallback local
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateNotificationPreference(
  userId: string,
  category: NotificationCategory,
  pref: NotificationCategoryPreference,
): Promise<void> {
  try {
    const current = await getNotificationPreferences(userId);
    const updated = { ...current, [category]: pref };
    const sb = getSupabaseClient();
    await sb.from('user_preferences').upsert(
      { id: userId, notifications: updated, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  } catch (e) {
    console.error('[updateNotificationPreference]', e);
  }
  // Also cache locally
  try {
    const current = await getNotificationPreferences(userId);
    const updated = { ...current, [category]: pref };
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  } catch {}
}
