//////////////////////////////////////////////////////////////////////////
//                          🧩 SettingsKit.tsx                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Briques communes aux pages de « Mon espace » : en-tête avec retour, sections,
 * cartes, lignes cliquables et sélecteurs à choix multiples.
 *
 * Tout passe par les tokens de useAppTheme() : ces composants suivent donc
 * automatiquement la couleur, la police, la taille de texte et l'arrondi
 * choisis par l'utilisateur.
 *
 * SOMMAIRE
 * Chap 1. Page et sections
 * Chap 2. Cartes et lignes
 * Chap 3. Sélecteurs
 */

import React, { ReactNode, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import { Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { ScreenContainer } from '@/components/ScreenContainer';

type Tokens = ThemeContextType;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/////////////////////////////// Chap 1. Page ///////////////////////////////

export function SettingsPage({
  title,
  subtitle,
  busy,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  busy?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/compte'))}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <MaterialIcons name="arrow-back" size={22} color={t.Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={t.Colors.primary} />
        ) : (
          (headerRight ?? <View style={{ width: 24 }} />)
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenContainer>{children}</ScreenContainer>
      </ScrollView>
    </View>
  );
}

export function SettingsSection({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.section}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/////////////////////////////// Chap 2. Cartes et lignes ///////////////////////////////

export function SettingsCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SettingsDivider() {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return <View style={styles.divider} />;
}

export function SettingsRow({
  icon,
  iconColor,
  label,
  description,
  value,
  onPress,
  right,
  danger,
  busy,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  busy?: boolean;
}) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const tint = danger ? t.Colors.error : (iconColor ?? t.Colors.primary);

  const body = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: tint + '18' }]}>
          {busy ? (
            <ActivityIndicator size="small" color={tint} />
          ) : (
            <MaterialIcons name={icon} size={20} color={tint} />
          )}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger ? { color: t.Colors.error } : null]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right ??
        (onPress ? (
          <MaterialIcons name="chevron-right" size={20} color={danger ? t.Colors.error : t.Colors.textMuted} />
        ) : null)}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

/////////////////////////////// Chap 3. Sélecteurs ///////////////////////////////

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  hint?: string;
  icon?: IconName;
}

/** Choix unique présenté en boutons côte à côte (ou en grille si ça déborde). */
export function SegmentPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.segmentRow}>
      {options.map(opt => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: t.Colors.primary, borderColor: t.Colors.primary }]}
          >
            {opt.icon ? (
              <MaterialIcons name={opt.icon} size={18} color={active ? t.Colors.textOnPrimary : t.Colors.textSubtle} />
            ) : null}
            <Text style={[styles.segmentLabel, active && { color: t.Colors.textOnPrimary }]}>{opt.label}</Text>
            {opt.hint ? (
              <Text style={[styles.segmentHint, active && { color: t.Colors.textOnPrimary, opacity: 0.85 }]}>
                {opt.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/////////////////////////////// Styles ///////////////////////////////

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo, Shadow } = t;
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { ...typo('lg', 'bold'), color: Colors.text },
    headerSubtitle: { ...typo('xs'), color: Colors.textMuted, marginTop: 1 },

    section: { marginHorizontal: Spacing.md, marginTop: Spacing.lg },
    sectionLabel: { ...typo('xs', 'bold'), color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
    sectionHint: { ...typo('xs'), color: Colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 },

    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      ...Shadow.sm,
    },
    divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 6 },

    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
    rowIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    rowLabel: { ...typo('md', 'medium'), color: Colors.text },
    rowDescription: { ...typo('xs'), color: Colors.textMuted, marginTop: 2, lineHeight: 17 },
    rowValue: { ...typo('sm'), color: Colors.textSubtle, maxWidth: 140 },

    segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    segment: {
      flexGrow: 1,
      flexBasis: 96,
      alignItems: 'center',
      gap: 3,
      paddingVertical: 10,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceMuted,
    },
    segmentLabel: { ...typo('sm', 'semibold'), color: Colors.textSubtle, textAlign: 'center' },
    segmentHint: { ...typo(10), color: Colors.textMuted, textAlign: 'center' },
  });
}
