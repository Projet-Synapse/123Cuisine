//////////////////////////////////////////////////////////////////////////
//                📧 NotificationPreferencesService.ts                  //
//////////////////////////////////////////////////////////////////////////

/*
 * Préférences de notifications par email (activité des personnes suivies, recommandations de plats, menus de la semaine), envoyées côté serveur par la fonction Edge send-notification-digests — indépendant des notifications push locales mobiles (cf. services/parametres/notificationService.ts).
 */

import { getSupabaseClient } from '@/template';

export type NotificationCategory = 'activity' | 'recommendations' | 'weekly_menus';
export type NotificationRecurrence = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CategoryPreference {
  enabled: boolean;
  recurrence: NotificationRecurrence;
}

export type NotificationPreferences = Record<NotificationCategory, CategoryPreference>;

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['activity', 'recommendations', 'weekly_menus'];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  activity: { enabled: false, recurrence: 'daily' },
  recommendations: { enabled: false, recurrence: 'weekly' },
  weekly_menus: { enabled: false, recurrence: 'weekly' },
};

export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('notification_preferences')
      .select('category, enabled, recurrence')
      .eq('user_id', userId);
    if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const row of data as { category: NotificationCategory; enabled: boolean; recurrence: NotificationRecurrence }[]) {
      prefs[row.category] = { enabled: row.enabled, recurrence: row.recurrence };
    }
    return prefs;
  } catch (e) {
    console.error('[getNotificationPreferences]', e);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
};

export const updateNotificationPreference = async (
  userId: string,
  category: NotificationCategory,
  pref: CategoryPreference
): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('notification_preferences').upsert({
      user_id: userId,
      category,
      enabled: pref.enabled,
      recurrence: pref.recurrence,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (e) {
    console.error('[updateNotificationPreference]', e);
    return false;
  }
};
