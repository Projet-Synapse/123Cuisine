//////////////////////////////////////////////////////////////////////////
//                       👁️ Confidentialite.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Confidentialité : visibilité du profil et des recettes.
 *
 * Honnêteté sur la portée : `is_public` masque le CONTENU de la page profil
 * (mur de créations, abonnés). Le pseudo et la photo restent lisibles, car ils
 * servent à afficher l'auteur des recettes publiques. Pour qu'une recette ne
 * soit vue par personne, c'est son propre réglage « publique » qui compte.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Switch, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { getMyProfile, updateMyProfile } from '@/services/parametres/profileService';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { SettingsPage, SettingsSection, SettingsCard, SettingsDivider } from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

export default function ConfidentialiteScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { recipes, togglePublic } = useKitchen();

  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = await getMyProfile(user.id);
      if (!cancelled) {
        if (p) setIsPublic(p.isPublic);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const publicRecipes = recipes.filter(r => r.isPublic);

  const handleToggleProfile = async (next: boolean) => {
    if (!user) return;
    setIsPublic(next);
    setSaving(true);
    const error = await updateMyProfile(user.id, { isPublic: next });
    setSaving(false);
    if (error) {
      setIsPublic(!next);
      showAlert('Enregistrement impossible', error);
    }
  };

  const handleUnshareAll = () => {
    if (publicRecipes.length === 0) return;
    showAlert(
      'Tout rendre privé ?',
      `${publicRecipes.length} recette(s) publique(s) redeviendront visibles de toi seule.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout rendre privé',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              for (const r of publicRecipes) await togglePublic(r.id);
            })();
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <SettingsPage title="Confidentialité">
        <SettingsSection>
          <SettingsCard>
            <Text style={styles.hint}>
              Sans compte, rien n&apos;est partagé : tes données restent sur cet appareil.
            </Text>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Confidentialité" busy={loading || saving}>
      {/* ── Profil ── */}
      <SettingsSection label="MON PROFIL">
        <SettingsCard>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Profil public</Text>
              <Text style={styles.hint}>
                {isPublic
                  ? 'Les autres peuvent ouvrir ton profil, voir tes recettes publiques et tes abonnés.'
                  : 'Ton profil est fermé : mur de créations et abonnés masqués.'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={next => void handleToggleProfile(next)}
              trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
              thumbColor={isPublic ? Colors.primary : Colors.surface}
            />
          </View>
          <SettingsDivider />
          <View style={styles.noteRow}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.note}>
              Ton pseudo et ta photo restent visibles sur les recettes que tu partages : c&apos;est ce qui permet de
              savoir qui en est l&apos;auteur.
            </Text>
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── Recettes ── */}
      <SettingsSection label="MES RECETTES" hint="Chaque recette a son propre réglage, modifiable depuis sa fiche.">
        <SettingsCard>
          <View style={styles.countRow}>
            <View style={[styles.countBadge, { backgroundColor: Colors.primary + '15' }]}>
              <MaterialIcons name="public" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{`${publicRecipes.length} recette(s) publique(s)`}</Text>
              <Text style={styles.hint}>{`sur ${recipes.length} au total`}</Text>
            </View>
          </View>
          {publicRecipes.length > 0 ? (
            <>
              <SettingsDivider />
              <Pressable style={styles.dangerBtn} onPress={handleUnshareAll}>
                <MaterialIcons name="lock" size={16} color={Colors.error} />
                <Text style={styles.dangerText}>Tout rendre privé</Text>
              </Pressable>
            </>
          ) : null}
          <SettingsDivider />
          <Pressable style={styles.linkRow} onPress={() => router.push('/recipes')}>
            <Text style={[styles.linkText, { color: Colors.primary }]}>Gérer recette par recette</Text>
            <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
          </Pressable>
        </SettingsCard>
      </SettingsSection>

      {/* ── Reste privé ── */}
      <SettingsSection label="TOUJOURS PRIVÉ">
        <SettingsCard>
          {['Tes listes de courses', 'Tes catégories et dossiers', 'Tes goûts et allergies', 'Ton adresse e-mail'].map(
            (label, idx) => (
              <View key={label}>
                {idx > 0 ? <SettingsDivider /> : null}
                <View style={styles.privateRow}>
                  <MaterialIcons name="lock" size={16} color={Colors.secondary} />
                  <Text style={styles.privateLabel}>{label}</Text>
                </View>
              </View>
            ),
          )}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
    toggleLabel: { ...typo('md', 'medium'), color: Colors.text },
    hint: { ...typo('xs'), color: Colors.textMuted, marginTop: 2, lineHeight: 17 },

    noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4 },
    note: { ...typo(11), color: Colors.textMuted, flex: 1, lineHeight: 16 },

    countRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
    countBadge: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },

    dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    dangerText: { ...typo('sm', 'semibold'), color: Colors.error },

    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    linkText: { ...typo('sm', 'semibold') },

    privateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
    privateLabel: { ...typo('sm'), color: Colors.textSubtle },
  });
}
