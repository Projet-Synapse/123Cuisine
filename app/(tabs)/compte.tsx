//////////////////////////////////////////////////////////////////////////
//                           🏠 Compte.tsx                               //
//////////////////////////////////////////////////////////////////////////

/*
 * « Mon espace » : le hub personnel. Il regroupe ce qui était éparpillé sur
 * quatre écrans (Compte, Préférences, Réglages, Notifications).
 *
 * SOMMAIRE
 * Chap 1. Carte de profil
 * Chap 2. Accès aux réglages
 * Chap 3. Mur de créations (recettes, catégories, groupes)
 * Chap 4. Styles
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth } from '@/template';
import { useResponsive } from '@/hooks/useResponsive';
import { ScreenContainer } from '@/components/ScreenContainer';
import { getPlaylistGroups, type PlaylistGroup } from '@/services/kitchenService';
import { getMyProfile, type UserProfileRecord } from '@/services/parametres/profileService';
import { getAvatarColor, getInitials, getTileRatio } from '@/utils/avatar';
import type { ThemeContextType } from '@/contexts/ThemeContext';

type Tokens = ThemeContextType;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/////////////////////////////// Types du mur ///////////////////////////////

type WallKind = 'recipe' | 'playlist' | 'group';

interface WallItem {
  key: string;
  kind: WallKind;
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  color?: string;
  icon: IconName;
}

const FILTERS: { key: WallKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'recipe', label: 'Recettes' },
  { key: 'playlist', label: 'Catégories' },
  { key: 'group', label: 'Groupes' },
];

const SETTINGS_LINKS: {
  href: string;
  icon: IconName;
  label: string;
  description: string;
  tint: 'primary' | 'secondary' | 'accent' | 'error';
}[] = [
  {
    href: '/apparence',
    icon: 'palette',
    label: 'Apparence',
    description: 'Couleurs, police, taille, arrondi',
    tint: 'primary',
  },
  {
    href: '/gouts',
    icon: 'restaurant-menu',
    label: 'Mes goûts',
    description: 'Régimes, allergies, ingrédients',
    tint: 'secondary',
  },
  {
    href: '/notifications',
    icon: 'notifications',
    label: 'Notifications',
    description: 'Rappels et résumés par e-mail',
    tint: 'accent',
  },
  {
    href: '/securite',
    icon: 'lock',
    label: 'Compte & sécurité',
    description: 'E-mail, mot de passe, suppression',
    tint: 'primary',
  },
  {
    href: '/confidentialite',
    icon: 'visibility',
    label: 'Confidentialité',
    description: 'Qui voit quoi',
    tint: 'secondary',
  },
  {
    href: '/donnees',
    icon: 'save',
    label: 'Mes données',
    description: 'Export, import, remise à zéro',
    tint: 'accent',
  },
  { href: '/a-propos', icon: 'info', label: 'À propos', description: 'Version et mises à jour', tint: 'primary' },
];

export default function MonEspaceScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { recipes, shoppingLists, playlists } = useKitchen();
  const { gridColumns } = useResponsive();

  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [loadingWall, setLoadingWall] = useState(true);
  const [filter, setFilter] = useState<WallKind | 'all'>('all');

  // Rechargé à chaque retour sur l'onglet : le profil et les groupes ne
  // passent pas par KitchenContext, ils ne se rafraîchiraient pas sinon.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [g, p] = await Promise.all([
          getPlaylistGroups(user?.id),
          user ? getMyProfile(user.id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setGroups(g);
        setProfile(p);
        setLoadingWall(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  /////////////////////////////// Mur ///////////////////////////////

  const wallItems = useMemo<WallItem[]>(() => {
    const items: WallItem[] = [];

    for (const r of recipes) {
      items.push({
        key: `recipe-${r.id}`,
        kind: 'recipe',
        id: r.id,
        title: r.title,
        subtitle: `${r.duration} min · ${r.difficulty}`,
        image: r.image,
        icon: 'restaurant',
      });
    }
    for (const p of playlists) {
      items.push({
        key: `playlist-${p.id}`,
        kind: 'playlist',
        id: p.id,
        title: p.name,
        subtitle: `${p.recipeIds.length} recette(s)`,
        color: p.coverColor,
        icon: 'playlist-play',
      });
    }
    for (const g of groups) {
      items.push({
        key: `group-${g.id}`,
        kind: 'group',
        id: g.id,
        title: g.name,
        subtitle: `${playlists.filter(p => p.groupIds.includes(g.id)).length} catégorie(s)`,
        image: g.imageUrl,
        color: g.color,
        icon: 'folder',
      });
    }
    return items;
  }, [recipes, playlists, groups]);

  const filtered = useMemo(
    () => (filter === 'all' ? wallItems : wallItems.filter(i => i.kind === filter)),
    [wallItems, filter],
  );

  // Répartition en colonnes de hauteur équilibrée : c'est ce qui donne
  // l'irrégularité « Pinterest » sans avoir à mesurer les images.
  const columns = useMemo(() => {
    const cols: WallItem[][] = Array.from({ length: gridColumns }, () => []);
    const heights = new Array(gridColumns).fill(0);
    for (const item of filtered) {
      const shortest = heights.indexOf(Math.min(...heights));
      cols[shortest].push(item);
      heights[shortest] += getTileRatio(item.id);
    }
    return cols;
  }, [filtered, gridColumns]);

  const openItem = (item: WallItem) => {
    if (item.kind === 'recipe') router.push(`/recipe/${item.id}` as never);
    else if (item.kind === 'playlist') router.push(`/playlist/${item.id}` as never);
    else router.push(`/playlists?group=${item.id}` as never);
  };

  /////////////////////////////// Rendu ///////////////////////////////

  const displayName = profile?.displayName || profile?.username || user?.email || 'Mode hors ligne';
  const avatarColor = getAvatarColor(user?.id ?? 'invite', profile?.avatarColor);
  const initials = getInitials(profile ?? { email: user?.email ?? null });

  const tintOf = (key: 'primary' | 'secondary' | 'accent' | 'error') => Colors[key];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenContainer style={{ paddingTop: insets.top + t.Spacing.sm }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mon espace</Text>
        </View>

        {/* ── Chap 1. Carte de profil ── */}
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { backgroundColor: user ? avatarColor : Colors.surfaceMuted },
                  ]}
                >
                  {user ? (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  ) : (
                    <MaterialIcons name="person-outline" size={30} color={Colors.textMuted} />
                  )}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.profileSub} numberOfLines={1}>
                  {user
                    ? profile?.username
                      ? `@${profile.username}`
                      : user.email
                    : 'Données stockées sur cet appareil'}
                </Text>
                {profile?.bio ? (
                  <Text style={styles.profileBio} numberOfLines={2}>
                    {profile.bio}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.statsRow}>
              {[
                { icon: 'menu-book' as IconName, value: recipes.length, label: 'recettes', color: Colors.primary },
                {
                  icon: 'playlist-play' as IconName,
                  value: playlists.length,
                  label: 'catégories',
                  color: Colors.accent,
                },
                {
                  icon: 'shopping-cart' as IconName,
                  value: shoppingLists.length,
                  label: 'listes',
                  color: Colors.secondary,
                },
              ].map(s => (
                <View key={s.label} style={[styles.statPill, { backgroundColor: s.color + '15' }]}>
                  <MaterialIcons name={s.icon} size={13} color={s.color} />
                  <Text style={[styles.statPillText, { color: s.color }]}>{`${s.value} ${s.label}`}</Text>
                </View>
              ))}
            </View>

            {user ? (
              <View style={styles.profileActions}>
                <Pressable
                  style={[styles.profileBtn, { backgroundColor: Colors.primary }]}
                  onPress={() => router.push('/profil-edit' as never)}
                >
                  <MaterialIcons name="edit" size={15} color={Colors.textOnPrimary} />
                  <Text style={[styles.profileBtnText, { color: Colors.textOnPrimary }]}>Modifier le profil</Text>
                </Pressable>
                <Pressable
                  style={[styles.profileBtnGhost, { borderColor: Colors.border }]}
                  onPress={() => router.push(`/profile/${user.id}` as never)}
                >
                  <MaterialIcons name="visibility" size={15} color={Colors.textSubtle} />
                  <Text style={[styles.profileBtnText, { color: Colors.textSubtle }]}>Voir mon profil public</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.profileBtn, { backgroundColor: Colors.primary }]}
                onPress={() => router.push('/login')}
              >
                <MaterialIcons name="login" size={15} color={Colors.textOnPrimary} />
                <Text style={[styles.profileBtnText, { color: Colors.textOnPrimary }]}>
                  Se connecter / Créer un compte
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Chap 2. Réglages ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réglages</Text>
          <View style={styles.card}>
            {SETTINGS_LINKS.map((link, idx) => (
              <View key={link.href}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <Pressable style={styles.menuRow} onPress={() => router.push(link.href as never)}>
                  <View style={[styles.menuIcon, { backgroundColor: tintOf(link.tint) + '18' }]}>
                    <MaterialIcons name={link.icon} size={20} color={tintOf(link.tint)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{link.label}</Text>
                    <Text style={styles.menuDescription}>{link.description}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* ── Chap 3. Mur de créations ── */}
        <View style={styles.section}>
          <View style={styles.wallHeader}>
            <Text style={styles.sectionTitle}>Mes créations</Text>
            <Text style={styles.wallCount}>{`${filtered.length} élément(s)`}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={{ marginBottom: t.Spacing.sm }}
          >
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterChip,
                    active
                      ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                      : { backgroundColor: Colors.surface, borderColor: Colors.border },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? Colors.textOnPrimary : Colors.textSubtle }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loadingWall ? (
            <View style={styles.wallEmpty}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.wallEmpty}>
              <MaterialIcons name="auto-awesome" size={28} color={Colors.textMuted} />
              <Text style={styles.wallEmptyText}>
                {filter === 'all' ? "Tu n'as encore rien créé." : 'Rien de ce type pour l’instant.'}
              </Text>
              <Pressable
                style={[styles.profileBtn, { backgroundColor: Colors.primary, alignSelf: 'center' }]}
                onPress={() => router.push('/create-recipe' as never)}
              >
                <MaterialIcons name="add" size={15} color={Colors.textOnPrimary} />
                <Text style={[styles.profileBtnText, { color: Colors.textOnPrimary }]}>Créer une recette</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.wall}>
              {columns.map((col, colIdx) => (
                <View key={colIdx} style={styles.wallColumn}>
                  {col.map(item => (
                    <Pressable key={item.key} onPress={() => openItem(item)} style={styles.tile}>
                      <View
                        style={[
                          styles.tileMedia,
                          {
                            height: 110 * getTileRatio(item.id),
                            backgroundColor: (item.color ?? Colors.primary) + '22',
                          },
                        ]}
                      >
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : (
                          <MaterialIcons name={item.icon} size={26} color={item.color ?? Colors.primary} />
                        )}
                        <View style={[styles.tileKind, { backgroundColor: Colors.surface + 'E6' }]}>
                          <MaterialIcons name={item.icon} size={11} color={Colors.textSubtle} />
                        </View>
                      </View>
                      <Text style={styles.tileTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.tileSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScreenContainer>
    </ScrollView>
  );
}

/////////////////////////////// Chap 4. Styles ///////////////////////////////

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo, Shadow } = t;
  return StyleSheet.create({
    header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
    headerTitle: { ...typo('xxl', 'bold'), color: Colors.text },

    section: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
    sectionTitle: { ...typo('lg', 'bold'), color: Colors.text, marginBottom: Spacing.sm },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      ...Shadow.sm,
    },
    divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },

    // Profil
    profileCard: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.md,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      ...Shadow.sm,
    },
    profileTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
    avatar: { width: 64, height: 64, borderRadius: Radius.round },
    avatarFallback: { justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { ...typo('xl', 'bold'), color: '#FFFFFF' },
    profileName: { ...typo('lg', 'bold'), color: Colors.text },
    profileSub: { ...typo('xs'), color: Colors.textMuted, marginTop: 1 },
    profileBio: { ...typo('xs'), color: Colors.textSubtle, marginTop: 4, lineHeight: 17 },

    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    statPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    statPillText: { ...typo(11, 'semibold') },

    profileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    profileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      flexGrow: 1,
      flexBasis: 150,
    },
    profileBtnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      flexGrow: 1,
      flexBasis: 150,
    },
    profileBtnText: { ...typo('sm', 'semibold') },

    // Réglages
    menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 9 },
    menuIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    menuLabel: { ...typo('md', 'medium'), color: Colors.text },
    menuDescription: { ...typo(11), color: Colors.textMuted, marginTop: 1 },

    // Mur
    wallHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    wallCount: { ...typo('xs'), color: Colors.textMuted },
    filterRow: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.md },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.round, borderWidth: 1 },
    filterChipText: { ...typo('sm', 'semibold') },

    wall: { flexDirection: 'row', gap: Spacing.sm },
    wallColumn: { flex: 1, gap: Spacing.sm },
    tile: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Colors.borderLight,
      paddingBottom: 8,
    },
    tileMedia: { width: '100%', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    tileKind: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 20,
      height: 20,
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tileTitle: { ...typo('sm', 'semibold'), color: Colors.text, paddingHorizontal: 8, paddingTop: 7 },
    tileSubtitle: { ...typo(10), color: Colors.textMuted, paddingHorizontal: 8, paddingTop: 2 },

    wallEmpty: {
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xl,
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    wallEmptyText: { ...typo('sm'), color: Colors.textMuted, textAlign: 'center' },
  });
}
