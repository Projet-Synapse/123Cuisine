//////////////////////////////////////////////////////////////////////////
//                           🎨 Apparence.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Personnalisation de l'interface : mode clair/sombre, couleur principale
 * (préréglée ou totalement libre), teinte des fonds, police, taille du texte
 * et arrondi des cartes. Un aperçu en direct montre le résultat avant que le
 * réglage ne soit appliqué à toute l'application.
 *
 * SOMMAIRE
 * Chap 1. Aperçu en direct
 * Chap 2. Écran et réglages
 * Chap 3. Styles
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAlert } from '@/template';
import {
  buildColors,
  resolveBaseColor,
  PRIMARY_PRESETS,
  BACKGROUND_TINTS,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  RADIUS_OPTIONS,
  type AppColors,
  type ThemeContextType,
  type PrimaryColorKey,
} from '@/contexts/ThemeContext';
import { hexToHsl, hslToHex, normalizeHex } from '@/utils/color';
import { SettingsPage, SettingsSection, SettingsCard, SegmentPicker } from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

/////////////////////////////// Chap 1. Aperçu ///////////////////////////////

/**
 * Rendu miniature de l'app avec les couleurs en cours de réglage. Il n'utilise
 * volontairement pas le thème actif : c'est ce qui permet de voir une couleur
 * pendant qu'on déplace un curseur, avant de valider.
 */
function LivePreview({ colors, t }: { colors: AppColors; t: Tokens }) {
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <View style={[styles.previewThumb, { backgroundColor: colors.primary + '22' }]}>
          <MaterialIcons name="restaurant" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>Ratatouille</Text>
          <Text style={[styles.previewSub, { color: colors.textSubtle }]}>35 min · 4 personnes</Text>
          <View style={styles.previewChips}>
            <View style={[styles.previewChip, { backgroundColor: colors.difficulty.Facile.bg }]}>
              <Text style={[styles.previewChipText, { color: colors.difficulty.Facile.fg }]}>Facile</Text>
            </View>
            <View style={[styles.previewChip, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.previewChipText, { color: colors.primary }]}>Végétarien</Text>
            </View>
            <MaterialIcons name="favorite" size={15} color={colors.favorite} />
          </View>
        </View>
      </View>

      <Pressable style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="add" size={16} color={colors.textOnPrimary} />
        <Text style={[styles.previewBtnText, { color: colors.textOnPrimary }]}>Ajouter aux courses</Text>
      </Pressable>

      <View style={[styles.previewTabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {(['home', 'search', 'shopping-cart', 'playlist-play', 'person'] as const).map((icon, i) => (
          <MaterialIcons key={icon} name={icon} size={18} color={i === 4 ? colors.primary : colors.textMuted} />
        ))}
      </View>
    </View>
  );
}

/////////////////////////////// Chap 2. Écran ///////////////////////////////

export default function ApparenceScreen() {
  const t = useAppTheme();
  const { Colors, settings, isDark, updateSettings, resetAppearance } = t;
  const { showAlert } = useAlert();
  const styles = useMemo(() => makeStyles(t), [t]);

  // Couleur en cours de manipulation : les curseurs restent fluides et
  // l'aperçu suit en direct, la validation n'a lieu qu'au relâchement.
  const committedBase = resolveBaseColor(settings);
  const [pendingBase, setPendingBase] = useState(committedBase);
  const [hexDraft, setHexDraft] = useState(committedBase);

  useEffect(() => {
    setPendingBase(committedBase);
    setHexDraft(committedBase);
  }, [committedBase]);

  const hsl = useMemo(() => hexToHsl(pendingBase), [pendingBase]);
  const previewColors = useMemo(
    () => buildColors(isDark, pendingBase, settings.backgroundTint),
    [isDark, pendingBase, settings.backgroundTint],
  );

  const setHslPart = (part: 'h' | 's' | 'l', v: number) => setPendingBase(hslToHex({ ...hsl, [part]: Math.round(v) }));

  const commitCustom = (hex: string) => {
    void updateSettings({ primaryColor: 'custom', customPrimary: hex });
  };

  const commitHexDraft = () => {
    const normalized = normalizeHex(hexDraft);
    if (!normalized) {
      setHexDraft(pendingBase);
      showAlert('Code couleur invalide', 'Utilise un format hexadécimal, par exemple #C0392B.');
      return;
    }
    setPendingBase(normalized);
    setHexDraft(normalized);
    commitCustom(normalized);
  };

  const handleReset = () => {
    showAlert("Réinitialiser l'apparence ?", 'Tous les réglages visuels reviendront à leurs valeurs par défaut.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: () => void resetAppearance() },
    ]);
  };

  return (
    <SettingsPage title="Apparence" subtitle="Ton interface, à ton image">
      <SettingsSection label="APERÇU">
        <LivePreview colors={previewColors} t={t} />
      </SettingsSection>

      {/* ── Mode ── */}
      <SettingsSection label="MODE D'AFFICHAGE">
        <SettingsCard>
          <SegmentPicker
            value={settings.mode}
            onChange={mode => void updateSettings({ mode })}
            options={[
              { key: 'light', label: 'Clair', icon: 'wb-sunny' },
              { key: 'dark', label: 'Sombre', icon: 'nightlight-round' },
              { key: 'system', label: 'Auto', icon: 'brightness-auto' },
            ]}
          />
        </SettingsCard>
      </SettingsSection>

      {/* ── Préréglages ── */}
      <SettingsSection
        label="COULEUR PRINCIPALE"
        hint="Choisis une ambiance toute faite, ou compose la tienne juste en dessous."
      >
        <SettingsCard>
          <View style={styles.swatchGrid}>
            {(
              Object.entries(PRIMARY_PRESETS) as [Exclude<PrimaryColorKey, 'custom'>, { label: string; base: string }][]
            ).map(([key, info]) => {
              const active = settings.primaryColor === key;
              const swatch = buildColors(isDark, info.base, settings.backgroundTint).primary;
              return (
                <Pressable
                  key={key}
                  onPress={() => void updateSettings({ primaryColor: key })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatch },
                    active && { borderColor: Colors.text, borderWidth: 3 },
                  ]}
                >
                  {active ? (
                    <MaterialIcons
                      name="check"
                      size={16}
                      color={buildColors(isDark, info.base, settings.backgroundTint).textOnPrimary}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.swatchLabel,
                      { color: buildColors(isDark, info.base, settings.backgroundTint).textOnPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {info.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── Couleur libre ── */}
      <SettingsSection
        label="MA COULEUR"
        hint="N'importe quelle couleur. Le texte des boutons s'adapte tout seul pour rester lisible."
      >
        <SettingsCard>
          <View style={styles.customHeader}>
            <View
              style={[styles.customSwatch, { backgroundColor: previewColors.primary, borderColor: Colors.border }]}
            />
            <TextInput
              value={hexDraft}
              onChangeText={setHexDraft}
              onBlur={commitHexDraft}
              onSubmitEditing={commitHexDraft}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              placeholder="#C0392B"
              placeholderTextColor={Colors.textMuted}
              style={styles.hexInput}
              accessibilityLabel="Code couleur hexadécimal"
            />
            {settings.primaryColor === 'custom' ? (
              <View style={[styles.activeBadge, { backgroundColor: Colors.primary + '18' }]}>
                <MaterialIcons name="check" size={13} color={Colors.primary} />
                <Text style={[styles.activeBadgeText, { color: Colors.primary }]}>Active</Text>
              </View>
            ) : null}
          </View>

          {(
            [
              { key: 'h', label: 'Teinte', max: 360 },
              { key: 's', label: 'Intensité', max: 100 },
              { key: 'l', label: 'Luminosité', max: 100 },
            ] as const
          ).map(({ key, label, max }) => (
            <View key={key} style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{label}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={max}
                step={1}
                value={hsl[key]}
                onValueChange={v => setHslPart(key, v)}
                onSlidingComplete={v => commitCustom(hslToHex({ ...hsl, [key]: Math.round(v) }))}
                minimumTrackTintColor={previewColors.primary}
                maximumTrackTintColor={Colors.border}
                thumbTintColor={previewColors.primary}
              />
              <Text style={styles.sliderValue}>{hsl[key]}</Text>
            </View>
          ))}
        </SettingsCard>
      </SettingsSection>

      {/* ── Teinte du fond ── */}
      <SettingsSection label="TEINTE DES FONDS">
        <SettingsCard>
          <SegmentPicker
            value={settings.backgroundTint}
            onChange={backgroundTint => void updateSettings({ backgroundTint })}
            options={BACKGROUND_TINTS.map(o => ({ key: o.key, label: o.label, hint: o.hint }))}
          />
        </SettingsCard>
      </SettingsSection>

      {/* ── Police ── */}
      <SettingsSection label="POLICE">
        <SettingsCard>
          <SegmentPicker
            value={settings.fontFamily}
            onChange={fontFamily => void updateSettings({ fontFamily })}
            options={FONT_FAMILY_OPTIONS.map(o => ({ key: o.key, label: o.label, hint: o.hint }))}
          />
        </SettingsCard>
      </SettingsSection>

      {/* ── Taille du texte ── */}
      <SettingsSection label="TAILLE DU TEXTE">
        <SettingsCard>
          <SegmentPicker
            value={settings.fontSize}
            onChange={fontSize => void updateSettings({ fontSize })}
            options={FONT_SIZE_OPTIONS.map(o => ({ key: o.key, label: o.label }))}
          />
        </SettingsCard>
      </SettingsSection>

      {/* ── Arrondi ── */}
      <SettingsSection label="ARRONDI DES CARTES">
        <SettingsCard>
          <SegmentPicker
            value={settings.radius}
            onChange={radius => void updateSettings({ radius })}
            options={RADIUS_OPTIONS.map(o => ({ key: o.key, label: o.label, hint: o.hint }))}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <MaterialIcons name="restart-alt" size={16} color={Colors.error} />
          <Text style={styles.resetText}>{"Réinitialiser l'apparence"}</Text>
        </Pressable>
      </SettingsSection>
    </SettingsPage>
  );
}

/////////////////////////////// Chap 3. Styles ///////////////////////////////

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    // Aperçu
    preview: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm, gap: Spacing.sm, overflow: 'hidden' },
    previewCard: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    previewThumb: { width: 52, height: 52, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    previewTitle: { ...typo('md', 'bold') },
    previewSub: { ...typo('xs') },
    previewChips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    previewChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round },
    previewChipText: { ...typo(10, 'semibold') },
    previewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.md,
    },
    previewBtnText: { ...typo('sm', 'bold') },
    previewTabBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      marginHorizontal: -Spacing.sm,
      marginBottom: -Spacing.sm,
    },

    // Préréglages
    swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    swatch: {
      flexGrow: 1,
      flexBasis: 76,
      height: 62,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      borderWidth: 0,
      paddingHorizontal: 4,
    },
    swatchLabel: { ...typo(10, 'semibold') },

    // Couleur libre
    customHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    customSwatch: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1 },
    hexInput: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      color: Colors.text,
      ...typo('md', 'medium'),
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    activeBadgeText: { ...typo(10, 'semibold') },

    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sliderLabel: { ...typo('xs'), color: Colors.textSubtle, width: 72 },
    slider: { flex: 1, height: 36 },
    sliderValue: { ...typo('xs', 'semibold'), color: Colors.textSubtle, width: 34, textAlign: 'right' },

    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.error + '40',
      backgroundColor: Colors.error + '0D',
    },
    resetText: { ...typo('sm', 'semibold'), color: Colors.error },
  });
}
