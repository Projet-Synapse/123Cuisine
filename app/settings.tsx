// Powered by OnSpace.AI
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform, Linking,
  ActivityIndicator, Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth, useAlert } from '@/template';
import { useKitchen } from '@/hooks/useKitchen';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  scheduleRecommendationNotifications,
  cancelAllNotifications,
} from '@/services/notificationService';
import type { ThemeMode, PrimaryColorKey } from '@/contexts/ThemeContext';

const FREQUENCY_OPTIONS: { value: NotificationSettings['frequency']; label: string; desc: string }[] = [
  { value: 'daily', label: 'Chaque jour', desc: 'Une recommandation par jour' },
  { value: 'weekly', label: 'Chaque semaine', desc: 'Une recommandation par semaine' },
  { value: 'never', label: 'Jamais', desc: 'Aucune notification' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const FONT_SIZE_OPTIONS: { value: 'small' | 'medium' | 'large'; label: string; desc: string }[] = [
  { value: 'small', label: 'Petite', desc: 'Texte compact' },
  { value: 'medium', label: 'Normale', desc: 'Taille par défaut' },
  { value: 'large', label: 'Grande', desc: 'Texte agrandi' },
];

const THEME_MODES: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: 'wb-sunny' },
  { value: 'dark', label: 'Sombre', icon: 'nightlight-round' },
  { value: 'system', label: 'Système', icon: 'brightness-auto' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors, settings: themeSettings, updateSettings, primaryColors, isDark } = useAppTheme();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { recipes } = useKitchen();
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const saved = await getNotificationSettings();
    setNotifSettings(saved);
    if (Platform.OS !== 'web') {
      try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionGranted(status === 'granted');
      } catch { setPermissionGranted(false); }
    }
  };

  const applyNotifSettings = useCallback(async (updated: NotificationSettings) => {
    setSaving(true);
    setNotifSettings(updated);
    await saveNotificationSettings(updated);
    if (updated.enabled && updated.frequency !== 'never') {
      const granted = await requestNotificationPermission();
      setPermissionGranted(granted);
      if (granted) {
        await scheduleRecommendationNotifications(updated, recipes);
      } else {
        showAlert('Permission refusée', 'Activez les notifications dans les paramètres.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir', onPress: () => Linking.openSettings() },
        ]);
      }
    } else {
      await cancelAllNotifications();
    }
    setSaving(false);
  }, [recipes, showAlert]);

  const handleLogout = () => {
    showAlert('Se déconnecter ?', 'Vos données restent sauvegardées dans le cloud.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  const styles = makeStyles(Colors, isDark);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Paramètres</Text>
        {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <View style={{ width: 24 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* ── ACCOUNT ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMPTE</Text>
          <View style={styles.card}>
            {user ? (
              <>
                <View style={styles.accountRow}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={26} color={Colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountEmail}>{user.email}</Text>
                    <Text style={styles.accountSub}>Synchronisé avec le cloud ☁️</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Pressable style={styles.actionRow} onPress={handleLogout}>
                  <MaterialIcons name="logout" size={20} color={Colors.error} />
                  <Text style={[styles.actionLabel, { color: Colors.error }]}>Se déconnecter</Text>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.error} />
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.avatar, { backgroundColor: Colors.surfaceMuted }]}>
                    <MaterialIcons name="person-outline" size={26} color={Colors.textMuted} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountEmail}>Mode hors ligne</Text>
                    <Text style={styles.accountSub}>Connectez-vous pour synchroniser</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Pressable style={styles.actionRow} onPress={() => router.push('/login')}>
                  <MaterialIcons name="login" size={20} color={Colors.primary} />
                  <Text style={[styles.actionLabel, { color: Colors.primary }]}>Se connecter / Créer un compte</Text>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.primary} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ── APPEARANCE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPARENCE</Text>
          <View style={styles.card}>

            {/* Theme mode */}
            <Text style={styles.subLabel}>Mode d'affichage</Text>
            <View style={styles.themeRow}>
              {THEME_MODES.map(opt => {
                const isActive = themeSettings.mode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.themeBtn, isActive && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => updateSettings({ mode: opt.value })}
                  >
                    <MaterialIcons name={opt.icon as any} size={20} color={isActive ? '#fff' : Colors.textSubtle} />
                    <Text style={[styles.themeBtnText, isActive && { color: '#fff' }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Primary color */}
            <Text style={styles.subLabel}>Couleur principale</Text>
            <View style={styles.colorGrid}>
              {(Object.entries(primaryColors) as [PrimaryColorKey, { label: string; value: string; dark: string; light: string }][]).map(([key, info]) => {
                const isActive = themeSettings.primaryColor === key;
                const swatchColor = isDark ? info.dark : info.value;
                return (
                  <Pressable
                    key={key}
                    style={[styles.colorSwatch, { backgroundColor: swatchColor }, isActive && styles.colorSwatchActive]}
                    onPress={() => updateSettings({ primaryColor: key })}
                  >
                    {isActive ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                    <Text style={styles.colorLabel} numberOfLines={1}>{info.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Font size */}
            <Text style={styles.subLabel}>Taille du texte</Text>
            <View style={styles.fontRow}>
              {FONT_SIZE_OPTIONS.map(opt => {
                const isActive = themeSettings.fontSize === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.fontBtn, isActive && { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}
                    onPress={() => updateSettings({ fontSize: opt.value })}
                  >
                    <Text style={[styles.fontBtnLabel, isActive && { color: Colors.primary }]}>{opt.label}</Text>
                    <Text style={[styles.fontBtnDesc, isActive && { color: Colors.primary + 'AA' }]}>{opt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

          </View>
        </View>

        {/* ── GOOGLE SIGN-IN ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONNEXION GOOGLE</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#EA43351A' }]}>
                <MaterialIcons name="account-circle" size={22} color="#EA4335" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Connexion avec Google</Text>
                <Text style={styles.infoDesc}>
                  Pour activer Google Sign-in, allez dans{' '}
                  <Text style={styles.infoBold}>Cloud → Utilisateurs → Auth Settings</Text>
                  {' '}et activez le provider Google avec votre Client ID et Secret.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── NOTIFICATIONS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS & RECOMMANDATIONS</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <MaterialIcons name="notifications" size={20} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Activer les notifications</Text>
                  <Text style={styles.settingDesc}>Recettes suggérées selon vos goûts</Text>
                </View>
              </View>
              <Switch
                value={notifSettings.enabled}
                onValueChange={v => applyNotifSettings({ ...notifSettings, enabled: v })}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={notifSettings.enabled ? Colors.primary : '#f4f3f4'}
              />
            </View>

            {notifSettings.enabled ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.subLabel}>Fréquence</Text>
                <View style={styles.frequencyGrid}>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.value}
                      style={[styles.freqBtn, notifSettings.frequency === opt.value && { backgroundColor: Colors.primary + '10', borderColor: Colors.primary }]}
                      onPress={() => applyNotifSettings({ ...notifSettings, frequency: opt.value })}
                    >
                      <Text style={[styles.freqLabel, notifSettings.frequency === opt.value && { color: Colors.primary }]}>{opt.label}</Text>
                      <Text style={[styles.freqDesc, notifSettings.frequency === opt.value && { color: Colors.primary + 'CC' }]}>{opt.desc}</Text>
                    </Pressable>
                  ))}
                </View>

                {notifSettings.frequency !== 'never' ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.subLabel}>Heure de la notification</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hoursList}>
                      {HOURS.filter(h => h >= 7 && h <= 22).map(h => (
                        <Pressable
                          key={h}
                          style={[styles.hourChip, notifSettings.time.hour === h && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                          onPress={() => applyNotifSettings({ ...notifSettings, time: { ...notifSettings.time, hour: h } })}
                        >
                          <Text style={[styles.hourText, notifSettings.time.hour === h && { color: '#fff', fontWeight: FontWeight.bold }]}>
                            {formatHour(h)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <View style={styles.divider} />
                    <Text style={styles.subLabel}>Type de recommandations</Text>
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <View style={[styles.settingIcon, { backgroundColor: '#FF6B6B15' }]}>
                          <MaterialIcons name="favorite" size={18} color="#FF6B6B" />
                        </View>
                        <View>
                          <Text style={styles.settingLabel}>Recettes favorites</Text>
                          <Text style={styles.settingDesc}>Rappel de vos coups de cœur</Text>
                        </View>
                      </View>
                      <Switch
                        value={notifSettings.notifyFavorites}
                        onValueChange={v => applyNotifSettings({ ...notifSettings, notifyFavorites: v })}
                        trackColor={{ false: Colors.border, true: '#FF6B6B80' }}
                        thumbColor={notifSettings.notifyFavorites ? '#FF6B6B' : '#f4f3f4'}
                      />
                    </View>
                    <View style={styles.miniDivider} />
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <View style={[styles.settingIcon, { backgroundColor: Colors.secondary + '15' }]}>
                          <MaterialIcons name="lightbulb" size={18} color={Colors.secondary} />
                        </View>
                        <View>
                          <Text style={styles.settingLabel}>Nouvelles idées</Text>
                          <Text style={styles.settingDesc}>Inspirations selon vos préférences</Text>
                        </View>
                      </View>
                      <Switch
                        value={notifSettings.notifyNewIdeas}
                        onValueChange={v => applyNotifSettings({ ...notifSettings, notifyNewIdeas: v })}
                        trackColor={{ false: Colors.border, true: Colors.secondary + '80' }}
                        thumbColor={notifSettings.notifyNewIdeas ? Colors.secondary : '#f4f3f4'}
                      />
                    </View>
                  </>
                ) : null}

                {!permissionGranted && notifSettings.enabled ? (
                  <>
                    <View style={styles.divider} />
                    <View style={[styles.warningBox, { backgroundColor: Colors.accent + '12' }]}>
                      <MaterialIcons name="warning" size={18} color={Colors.accent} />
                      <Text style={[styles.warningText, { color: Colors.accent }]}>Notifications non autorisées. Activez-les dans les paramètres.</Text>
                      <Pressable onPress={() => Linking.openSettings()}>
                        <Text style={[styles.warningLink, { color: Colors.accent }]}>Ouvrir</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        {/* ── CODE ACCESS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CODE & DÉVELOPPEMENT</Text>
          <View style={styles.card}>
            <Pressable
              style={[styles.codeAccessBtn, { backgroundColor: Colors.primary }]}
              onPress={() => showAlert(
                'Accéder au code source',
                'Cliquez sur le bouton </> en haut à droite de l\'interface OnSpace pour ouvrir l\'éditeur de code et modifier tous les fichiers du projet.',
                [
                  { text: 'Compris', style: 'default' },
                ]
              )}
            >
              <View style={styles.codeBtnLeft}>
                <View style={styles.codeBtnIcon}>
                  <MaterialIcons name="code" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={styles.codeBtnTitle}>Voir le code source</Text>
                  <Text style={styles.codeBtnDesc}>Ouvrir l'éditeur de fichiers</Text>
                </View>
              </View>
              <MaterialIcons name="open-in-new" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={[styles.codeHintBox, { backgroundColor: Colors.surfaceMuted }]}>
              <MaterialIcons name="info-outline" size={16} color={Colors.textSubtle} />
              <Text style={[styles.codeHintText, { color: Colors.textSubtle }]}>
                Cliquez sur le bouton{' '}
                <Text style={{ fontWeight: FontWeight.bold, color: Colors.text }}>{'</>'}</Text>
                {' '}en haut à droite de l'interface OnSpace
              </Text>
            </View>
          </View>
        </View>

        {/* ── ABOUT ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>À PROPOS</Text>
          <View style={styles.card}>
            <Pressable onPress={() => {
              const next = devTapCount + 1;
              setDevTapCount(next);
              if (next >= 7) { setDevMode(true); setDevTapCount(0); showAlert('Mode développeur activé', 'Vous avez accès aux outils de développement.'); }
            }}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>1.0.0 {devMode ? '🛠️' : ''}</Text>
              </View>
            </Pressable>
            <View style={styles.miniDivider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Application</Text>
              <Text style={styles.aboutValue}>MaCuisine</Text>
            </View>
            <View style={styles.miniDivider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Recettes enregistrées</Text>
              <Text style={styles.aboutValue}>{recipes.length}</Text>
            </View>
            {devTapCount > 0 && devTapCount < 7 ? (
              <Text style={{ fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                {7 - devTapCount} tap{7 - devTapCount > 1 ? 's' : ''} pour activer le mode développeur
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── DEVELOPER MODE ── */}
        {devMode ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: Colors.primary }]}>🛠️ MODE DÉVELOPPEUR</Text>
            <View style={styles.card}>

              {/* Code access */}
              <View style={styles.devBlock}>
                <View style={[styles.devIconBox, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialIcons name="code" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devTitle}>Accès au code source</Text>
                  <Text style={styles.devDesc}>
                    Cliquez sur le bouton {"</>"} en haut à droite de l'écran OnSpace pour basculer en mode Code et voir/modifier tous les fichiers du projet.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* APK download */}
              <View style={styles.devBlock}>
                <View style={[styles.devIconBox, { backgroundColor: '#34A85318' }]}>
                  <MaterialIcons name="android" size={22} color="#34A853" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devTitle}>Télécharger l'APK Android</Text>
                  <Text style={styles.devDesc}>
                    Cliquez sur l'icône de téléchargement ↓ en haut à droite de OnSpace, puis choisissez "Télécharger APK". L'APK sera générée et téléchargeable pour installation sur Android.
                  </Text>
                  <Pressable
                    style={[styles.devBtn, { backgroundColor: '#34A85318', borderColor: '#34A85340' }]}
                    onPress={() => Linking.openURL('https://onspace.ai')}
                  >
                    <MaterialIcons name="file-download" size={16} color="#34A853" />
                    <Text style={[styles.devBtnText, { color: '#34A853' }]}>Aller sur OnSpace pour télécharger</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Interface customization */}
              <View style={styles.devBlock}>
                <View style={[styles.devIconBox, { backgroundColor: Colors.accent + '18' }]}>
                  <MaterialIcons name="palette" size={22} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devTitle}>Personnaliser l'interface</Text>
                  <Text style={styles.devDesc}>
                    Dans le code source, modifiez{' '}
                    <Text style={{ fontWeight: FontWeight.bold, color: Colors.text }}>constants/theme.ts</Text>
                    {' '}pour les couleurs, polices et espacements. Ou discutez avec l'IA dans le chat pour appliquer des changements visuels à la demande.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Debug info */}
              <View style={styles.devBlock}>
                <View style={[styles.devIconBox, { backgroundColor: '#9B59B618' }]}>
                  <MaterialIcons name="bug-report" size={22} color="#9B59B6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devTitle}>Informations de débogage</Text>
                  <View style={[styles.debugBox, { backgroundColor: Colors.surfaceMuted }]}>
                    <Text style={[styles.debugLine, { color: Colors.textSubtle }]}>User ID: {user?.id?.slice(0, 8) ?? 'Non connecté'}...</Text>
                    <Text style={[styles.debugLine, { color: Colors.textSubtle }]}>Email: {user?.email ?? 'N/A'}</Text>
                    <Text style={[styles.debugLine, { color: Colors.textSubtle }]}>Recettes: {recipes.length}</Text>
                    <Text style={[styles.debugLine, { color: Colors.textSubtle }]}>Thème: {themeSettings.mode} / {themeSettings.primaryColor}</Text>
                    <Text style={[styles.debugLine, { color: Colors.textSubtle }]}>Plateforme: {Platform.OS}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <Pressable
                style={[styles.devDangerBtn, { borderColor: Colors.error + '40' }]}
                onPress={() => {
                  setDevMode(false);
                  showAlert('Mode développeur désactivé', '');
                }}
              >
                <MaterialIcons name="developer-mode" size={16} color={Colors.error} />
                <Text style={[styles.devBtnText, { color: Colors.error }]}>Désactiver le mode développeur</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(Colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
    sectionLabel: {
      fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textMuted,
      letterSpacing: 1, marginBottom: Spacing.sm, marginLeft: 4,
    },
    card: {
      backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
      shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
    avatar: {
      width: 50, height: 50, borderRadius: Radius.round,
      backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center',
    },
    accountInfo: { flex: 1 },
    accountEmail: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
    accountSub: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
    miniDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 6 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    actionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
    infoRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    infoIcon: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    infoContent: { flex: 1 },
    infoTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 4 },
    infoDesc: { fontSize: FontSize.sm, color: Colors.textSubtle, lineHeight: 20 },
    infoBold: { fontWeight: FontWeight.bold, color: Colors.text },
    subLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSubtle, marginBottom: Spacing.sm, marginTop: Spacing.sm },

    // Theme
    themeRow: { flexDirection: 'row', gap: Spacing.sm },
    themeBtn: {
      flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
      borderRadius: Radius.md, backgroundColor: Colors.surfaceMuted,
      borderWidth: 1.5, borderColor: Colors.border,
    },
    themeBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSubtle },

    // Color swatches
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    colorSwatch: {
      width: 72, alignItems: 'center', justifyContent: 'flex-end',
      paddingBottom: 6, paddingTop: 20, borderRadius: Radius.md,
      borderWidth: 3, borderColor: 'transparent',
    },
    colorSwatchActive: { borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    colorLabel: { fontSize: 9, color: '#fff', fontWeight: FontWeight.bold, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

    // Font size
    fontRow: { flexDirection: 'row', gap: Spacing.sm },
    fontBtn: {
      flex: 1, paddingVertical: 10, paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md, backgroundColor: Colors.surfaceMuted,
      borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
    },
    fontBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
    fontBtnDesc: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

    // Notifications
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    settingIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    settingDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
    frequencyGrid: { gap: Spacing.sm },
    freqBtn: {
      paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md,
      backgroundColor: Colors.surfaceMuted, borderWidth: 1.5, borderColor: Colors.border,
    },
    freqLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
    freqDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
    hoursList: { gap: 8, paddingVertical: 4 },
    hourChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.round,
      backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: Colors.border,
    },
    hourText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSubtle },
    warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: Spacing.sm, marginTop: 4 },
    warningText: { flex: 1, fontSize: FontSize.xs },
    warningLink: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textDecorationLine: 'underline' },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    aboutLabel: { fontSize: FontSize.sm, color: Colors.textSubtle },
    aboutValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },

    // Code access
    codeAccessBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    codeBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    codeBtnIcon: {
      width: 40, height: 40, borderRadius: Radius.md,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center', alignItems: 'center',
    },
    codeBtnTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
    codeBtnDesc: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    codeHintBox: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderRadius: Radius.md, padding: Spacing.sm,
    },
    codeHintText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

    // Developer mode
    devBlock: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', paddingVertical: Spacing.sm },
    devIconBox: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    devTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 4 },
    devDesc: { fontSize: FontSize.sm, color: Colors.textSubtle, lineHeight: 20 },
    devBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, alignSelf: 'flex-start' },
    devDangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xs ?? 4, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
    devBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    debugBox: { marginTop: Spacing.sm, borderRadius: Radius.sm, padding: Spacing.sm, gap: 4 },
    debugLine: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  });
}
