//////////////////////////////////////////////////////////////////////////
//                          🔔 Notifications.tsx                        //
//////////////////////////////////////////////////////////////////////////

/*
 * Préférences de notifications par email : activité des personnes suivies, recommandations de plats, menus de la semaine (à venir) — chacune avec sa propre récurrence. Envoyées côté serveur (fonction Edge send-notification-digests), donc actives même app fermée ; sur desktop c'est actuellement le seul canal (pas de notification push).
 */

// -> Code à organiser

// SOMMAIRE
/////////////////////////////// Chap 1. [...] ///////////////////////////////////////////
/////////////////////////////// Chap 2. [...] ///////////////////////////////////////////
/////////////////////////////// Chap 3. [...] ///////////////////////////////////////////

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Switch, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useAuth } from '@/template';
import {
  NotificationCategory,
  NotificationRecurrence,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/parametres/notificationPreferencesService';

const CATEGORY_INFO: {
  value: NotificationCategory;
  icon: string;
  label: string;
  desc: string;
  comingSoon?: boolean;
}[] = [
  {
    value: 'activity',
    icon: 'people',
    label: 'Activité des personnes suivies',
    desc: 'Nouvelles recettes partagées par les cuisiniers que vous suivez',
  },
  {
    value: 'recommendations',
    icon: 'restaurant-menu',
    label: 'Recommandations de plats',
    desc: 'Des idées de recettes selon vos favoris',
  },
  {
    value: 'weekly_menus',
    icon: 'event-note',
    label: 'Menus de la semaine',
    desc: 'Un menu complet suggéré pour la semaine',
    comingSoon: true,
  },
];

const RECURRENCE_OPTIONS: { value: NotificationRecurrence; label: string }[] = [
  { value: 'hourly', label: 'Toutes les heures' },
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'yearly', label: 'Chaque année' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      const loaded = await getNotificationPreferences(user.id);
      setPrefs(loaded);
      setLoading(false);
    })();
  }, [user]);

  const applyChange = async (
    category: NotificationCategory,
    patch: Partial<NotificationPreferences[NotificationCategory]>,
  ) => {
    if (!user) return;
    const updated = { ...prefs[category], ...patch };
    setPrefs(prev => ({ ...prev, [category]: updated }));
    setSaving(true);
    await updateNotificationPreference(user.id, category, updated);
    setSaving(false);
  };

  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <View style={{ width: 24 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.section}>
          <View style={[styles.infoBox, { backgroundColor: Colors.primary + '12' }]}>
            <MaterialIcons name="mail-outline" size={18} color={Colors.primary} />
            <Text style={[styles.infoText, { color: Colors.primary }]}>
              {
                "Sur cette version (desktop), les notifications sont envoyées par email — il n'y a pas encore de notification push."
              }
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          CATEGORY_INFO.map(cat => {
            const pref = prefs[cat.value];
            return (
              <View key={cat.value} style={styles.section}>
                <Text style={styles.sectionLabel}>{cat.label.toUpperCase()}</Text>
                <View style={styles.card}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
                        <MaterialIcons name={cat.icon as any} size={20} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.settingLabel}>{cat.label}</Text>
                          {cat.comingSoon ? (
                            <View style={[styles.badge, { backgroundColor: Colors.accent + '20' }]}>
                              <Text style={[styles.badgeText, { color: Colors.accent }]}>Bientôt disponible</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.settingDesc}>{cat.desc}</Text>
                      </View>
                    </View>
                    <Switch
                      value={pref.enabled}
                      onValueChange={v => applyChange(cat.value, { enabled: v })}
                      trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                      thumbColor={pref.enabled ? Colors.primary : '#f4f3f4'}
                    />
                  </View>

                  {pref.enabled ? (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.subLabel}>Fréquence</Text>
                      <View style={styles.frequencyGrid}>
                        {RECURRENCE_OPTIONS.map(opt => {
                          const isActive = pref.recurrence === opt.value;
                          return (
                            <Pressable
                              key={opt.value}
                              style={[
                                styles.freqBtn,
                                isActive && { backgroundColor: Colors.primary + '10', borderColor: Colors.primary },
                              ]}
                              onPress={() => void applyChange(cat.value, { recurrence: opt.value })}
                            >
                              <Text style={[styles.freqLabel, isActive && { color: Colors.primary }]}>{opt.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(t: ThemeContextType) {
  const { Colors, Radius, FontSize } = t;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
    sectionLabel: {
      fontSize: 11,
      fontWeight: FontWeight.bold,
      color: Colors.textMuted,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginLeft: 4,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    settingIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    settingDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
    subLabel: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: Colors.textSubtle,
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    frequencyGrid: { gap: Spacing.sm },
    freqBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceMuted,
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
    freqLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.round },
    badgeText: { fontSize: 10, fontWeight: FontWeight.bold },
    infoBox: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'flex-start',
      padding: Spacing.md,
      borderRadius: Radius.md,
    },
    infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  });
}
