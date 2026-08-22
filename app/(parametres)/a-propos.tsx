//////////////////////////////////////////////////////////////////////////
//                            ℹ️ APropos.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * À propos : version, chiffres de l'app, mises à jour de la version desktop,
 * et mode développeur (déverrouillé en tapant 7 fois sur la version).
 *
 * Reprend la fin de l'ancien écran Réglages, désormais éclaté en pages
 * dédiées dans « Mon espace ».
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Linking, ActivityIndicator, Switch } from 'react-native';
import { Text } from '@/components/Themed';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth, useAlert } from '@/template';
import { useKitchen } from '@/hooks/useKitchen';
import { useDesktopUpdater } from '@/hooks/useDesktopUpdater';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { SettingsPage, SettingsSection, SettingsCard, SettingsDivider } from '@/components/settings/SettingsKit';

// Pont exposé par electron/preload.js — absent partout ailleurs que sur l'app
// de bureau, d'où la section entière conditionnée à updater.isDesktop.
interface DesktopPrefsBridge {
  get: () => Promise<{ confirmQuit: boolean }>;
  setConfirmQuit: (value: boolean) => Promise<{ ok: boolean; confirmQuit: boolean }>;
}

function getDesktopPrefsBridge(): DesktopPrefsBridge | null {
  if (typeof globalThis === 'undefined') return null;
  const bridge = (globalThis as { desktopPrefs?: DesktopPrefsBridge }).desktopPrefs;
  return typeof bridge?.get === 'function' ? bridge : null;
}

type Tokens = ThemeContextType;

const APP_VERSION = Constants.expoConfig?.version ?? '—';

export default function AProposScreen() {
  const t = useAppTheme();
  const { Colors, settings } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { recipes, shoppingLists, categories } = useKitchen();
  const updater = useDesktopUpdater();

  const [devMode, setDevMode] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(true);

  useEffect(() => {
    const bridge = getDesktopPrefsBridge();
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .get()
      .then(prefs => {
        if (!cancelled && typeof prefs?.confirmQuit === 'boolean') setConfirmQuit(prefs.confirmQuit);
      })
      .catch(() => {
        /* réglage indisponible : on garde la valeur par défaut */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleConfirmQuit = (next: boolean) => {
    setConfirmQuit(next);
    void getDesktopPrefsBridge()
      ?.setConfirmQuit(next)
      .catch(() => setConfirmQuit(!next));
  };

  const version = updater.isDesktop && updater.currentVersion ? updater.currentVersion : APP_VERSION;

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 7) {
      setDevMode(true);
      setDevTapCount(0);
      showAlert('Mode développeur activé', 'Les outils de développement sont accessibles plus bas.');
    }
  };

  const handleCopyUpdateLog = async () => {
    const result = await updater.getLogTail();
    if (!result || !result.ok || !result.content) {
      showAlert('Journal indisponible', result?.error || "Aucun journal de mise à jour trouvé pour l'instant.");
      return;
    }
    await Clipboard.setStringAsync(result.content);
    showAlert('Journal copié', `Les dernières lignes du journal (${result.path}) ont été copiées.`);
  };

  const updateStatusLabel = () => {
    switch (updater.status) {
      case 'checking':
        return 'Vérification…';
      case 'available':
        return `Nouvelle version ${updater.availableVersion ?? ''}`;
      case 'downloading':
        return `Téléchargement… ${typeof updater.progress === 'number' ? Math.round(updater.progress) + '%' : ''}`;
      case 'downloaded':
        return `Prête à installer (${updater.availableVersion ?? ''})`;
      case 'not-available':
        return 'À jour ✓';
      case 'error':
        return 'Indisponible';
      default:
        return 'Non vérifié';
    }
  };

  const facts: [string, string][] = [
    ['Application', '123Cuisine'],
    ['Recettes enregistrées', String(recipes.length)],
    ['Listes de courses', String(shoppingLists.length)],
    ['Catégories', String(categories.length)],
  ];

  return (
    <SettingsPage title="À propos">
      <SettingsSection label="VERSION">
        <SettingsCard>
          <Pressable onPress={handleVersionTap}>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Version</Text>
              <Text style={styles.factValue}>{`${version} ${devMode ? '🛠️' : ''}`}</Text>
            </View>
          </Pressable>
          {facts.map(([label, value]) => (
            <View key={label}>
              <SettingsDivider />
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>{label}</Text>
                <Text style={styles.factValue}>{value}</Text>
              </View>
            </View>
          ))}
          {devTapCount > 0 && devTapCount < 7 ? (
            <Text style={styles.tapHint}>
              {`${7 - devTapCount} tap${7 - devTapCount > 1 ? 's' : ''} pour activer le mode développeur`}
            </Text>
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection label="LANGUE">
        <SettingsCard>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Langue de l&apos;interface</Text>
            <Text style={styles.factValue}>Français</Text>
          </View>
          <Text style={styles.tapHint}>D&apos;autres langues arriveront plus tard.</Text>
        </SettingsCard>
      </SettingsSection>

      {/* ── Réglages propres au bureau ── */}
      {updater.isDesktop ? (
        <SettingsSection label="APPLICATION DE BUREAU">
          <SettingsCard>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Confirmer avant de quitter</Text>
                <Text style={styles.tapHintLeft}>
                  Demande confirmation quand on ferme la fenêtre, histoire de ne pas partir le ventre vide.
                </Text>
              </View>
              <Switch
                value={confirmQuit}
                onValueChange={handleToggleConfirmQuit}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={confirmQuit ? Colors.primary : Colors.surface}
              />
            </View>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {/* ── Mises à jour (desktop) ── */}
      {updater.isDesktop ? (
        <SettingsSection label="MISES À JOUR">
          <SettingsCard>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>État</Text>
              <Text style={styles.factValue}>{updateStatusLabel()}</Text>
            </View>
            {updater.status === 'error' && updater.error ? <Text style={styles.tapHint}>{updater.error}</Text> : null}
            <SettingsDivider />
            {updater.status === 'available' ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                onPress={() => void updater.downloadUpdate()}
              >
                <MaterialIcons name="download" size={16} color={Colors.textOnPrimary} />
                <Text style={[styles.actionText, { color: Colors.textOnPrimary }]}>Télécharger la mise à jour</Text>
              </Pressable>
            ) : updater.status === 'downloaded' ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.secondary }]}
                onPress={() => void updater.installUpdate()}
              >
                <MaterialIcons name="restart-alt" size={16} color="#FFFFFF" />
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Redémarrer et installer</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.surfaceMuted }]}
                onPress={() => void updater.checkForUpdates()}
                disabled={updater.status === 'checking' || updater.status === 'downloading'}
              >
                {updater.status === 'checking' ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <MaterialIcons name="refresh" size={16} color={Colors.primary} />
                )}
                <Text style={[styles.actionText, { color: Colors.primary }]}>Vérifier les mises à jour</Text>
              </Pressable>
            )}
            <Pressable style={styles.copyLogBtn} onPress={() => void handleCopyUpdateLog()}>
              <MaterialIcons name="bug-report" size={14} color={Colors.textMuted} />
              <Text style={styles.copyLogText}>Copier le journal de mise à jour</Text>
            </Pressable>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {/* ── Mode développeur ── */}
      {devMode ? (
        <SettingsSection label="🛠️ MODE DÉVELOPPEUR">
          <SettingsCard>
            <View style={[styles.debugBox, { backgroundColor: Colors.surfaceMuted }]}>
              <Text style={styles.debugLine}>{`Utilisateur : ${user?.email ?? 'non connecté'}`}</Text>
              <Text style={styles.debugLine}>{`ID : ${user?.id?.slice(0, 8) ?? 'N/A'}…`}</Text>
              <Text style={styles.debugLine}>{`Plateforme : ${Platform.OS}`}</Text>
              <Text style={styles.debugLine}>{`Mode : ${settings.mode}`}</Text>
              <Text style={styles.debugLine}>
                {`Couleur : ${settings.primaryColor}${settings.primaryColor === 'custom' ? ` (${settings.customPrimary})` : ''}`}
              </Text>
              <Text
                style={styles.debugLine}
              >{`Fond : ${settings.backgroundTint} · Police : ${settings.fontFamily}`}</Text>
              <Text style={styles.debugLine}>{`Texte : ${settings.fontSize} · Arrondi : ${settings.radius}`}</Text>
            </View>
            <SettingsDivider />
            <Pressable style={styles.linkBtn} onPress={() => void Linking.openURL('https://github.com')}>
              <MaterialIcons name="code" size={16} color={Colors.primary} />
              <Text style={[styles.actionText, { color: Colors.primary }]}>Code source du projet</Text>
            </Pressable>
            <SettingsDivider />
            <Pressable
              style={styles.linkBtn}
              onPress={() => {
                setDevMode(false);
                showAlert('Mode développeur désactivé', '');
              }}
            >
              <MaterialIcons name="developer-mode" size={16} color={Colors.error} />
              <Text style={[styles.actionText, { color: Colors.error }]}>Désactiver le mode développeur</Text>
            </Pressable>
          </SettingsCard>
        </SettingsSection>
      ) : null}
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    factRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
      gap: Spacing.md,
    },
    factLabel: { ...typo('sm'), color: Colors.textSubtle },
    factValue: { ...typo('sm', 'semibold'), color: Colors.text },
    tapHint: { ...typo(10), color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
    tapHintLeft: { ...typo(11), color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
    toggleLabel: { ...typo('md', 'medium'), color: Colors.text },

    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: Radius.md,
    },
    actionText: { ...typo('sm', 'semibold') },
    copyLogBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
    copyLogText: { ...typo('xs'), color: Colors.textMuted },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },

    debugBox: { borderRadius: Radius.md, padding: Spacing.sm, gap: 3 },
    debugLine: {
      ...typo(11),
      color: Colors.textSubtle,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
  });
}
