// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { SUPERMARKETS } from '@/constants/config';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors, isDark } = useAppTheme();
  const { recipes, shoppingLists, preferences, loading } = useKitchen();

  const favoriteRecipes = useMemo(() => recipes.filter(r => r.isFavorite), [recipes]);
  const recentRecipes = useMemo(() => [...recipes].slice(0, 4), [recipes]);
  const activeList = useMemo(() => shoppingLists[0], [shoppingLists]);
  const uncheckedCount = useMemo(() => activeList?.items.filter(i => !i.checked).length ?? 0, [activeList]);

  const getSupermarket = (id: string) => SUPERMARKETS.find(s => s.id === id) || SUPERMARKETS[SUPERMARKETS.length - 1];

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingBottom: Spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Image source={require('@/assets/images/hero-kitchen.jpg')} style={styles.heroImage} contentFit="cover" transition={300} />
        <View style={[styles.heroOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(44,24,16,0.45)' }]} />
        <View style={styles.heroContent}>
          <Text style={styles.greeting}>Bonjour 👨‍🍳</Text>
          <Text style={styles.heroTitle}>{"Qu'est-ce qu'on cuisine aujourd'hui ?"}</Text>
        </View>
      </View>

      <View style={{ padding: Spacing.md }}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'menu-book', color: Colors.primary, count: recipes.length, label: 'Recettes', route: '/(tabs)/recipes' },
            { icon: 'shopping-cart', color: Colors.secondary, count: shoppingLists.length, label: 'Listes', route: '/(tabs)/shopping' },
            { icon: 'favorite', color: Colors.accent, count: preferences.likedIngredients.length, label: 'Favoris', route: '/(tabs)/preferences' },
          ].map(s => (
            <Pressable key={s.label} style={[styles.statCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(s.route as any)}>
              <MaterialIcons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statNumber, { color: Colors.text }]}>{s.count}</Text>
              <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Active list */}
        {activeList ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Liste en cours</Text>
            <Pressable style={[styles.activeListCard, { backgroundColor: Colors.surface, borderLeftColor: activeList.color, ...Shadow.sm }]} onPress={() => router.push(`/list/${activeList.id}`)}>
              <View style={styles.activeListHeader}>
                <View>
                  <Text style={[styles.activeListName, { color: Colors.text }]}>{activeList.name}</Text>
                  <Text style={[styles.activeListSup, { color: Colors.textSubtle }]}>{getSupermarket(activeList.supermarketId).name}</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: activeList.color }]}>
                  <Text style={styles.countBadgeText}>{uncheckedCount} article{uncheckedCount > 1 ? 's' : ''}</Text>
                </View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: Colors.border }]}>
                <View style={[styles.progressFill, {
                  backgroundColor: activeList.color,
                  width: `${activeList.items.length > 0 ? ((activeList.items.length - uncheckedCount) / activeList.items.length) * 100 : 0}%`,
                }]} />
              </View>
              <Text style={[styles.progressText, { color: Colors.textMuted }]}>{activeList.items.length - uncheckedCount} / {activeList.items.length} cochés</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Favorites */}
        {favoriteRecipes.length > 0 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Coups de cœur ❤️</Text>
              <Pressable onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={[styles.seeAll, { color: Colors.primary }]}>Tout voir</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {favoriteRecipes.map(recipe => (
                <Pressable key={recipe.id} style={[styles.favoriteCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                  <View style={[styles.favoriteEmoji, { backgroundColor: Colors.surfaceMuted }]}>
                    {recipe.image ? (
                      <Image source={{ uri: recipe.image }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 32 }}>🍽️</Text>
                    )}
                  </View>
                  <Text style={[styles.favoriteTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Recent recipes */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Toutes les recettes</Text>
            <Pressable onPress={() => router.push('/(tabs)/recipes')}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>Voir plus</Text>
            </Pressable>
          </View>
          {recentRecipes.map(recipe => (
            <Pressable key={recipe.id} style={[styles.recipeRow, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/recipe/${recipe.id}`)}>
              <View style={[styles.recipeRowIcon, { backgroundColor: Colors.surfaceMuted }]}>
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={{ width: 48, height: 48 }} contentFit="cover" />
                ) : (
                  <Text style={{ fontSize: 24 }}>🍽️</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recipeRowTitle, { color: Colors.text }]} numberOfLines={1}>{recipe.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min</Text>
                  <Text style={{ color: Colors.textMuted, marginHorizontal: 2 }}>·</Text>
                  <MaterialIcons name="people" size={12} color={Colors.textMuted} />
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.servings} pers.</Text>
                </View>
              </View>
              <View style={[styles.diffBadge, {
                backgroundColor: recipe.difficulty === 'Facile' ? '#E8F5E9' : recipe.difficulty === 'Moyen' ? '#FFF3E0' : '#FFEBEE',
              }]}>
                <Text style={[styles.diffText, { color: recipe.difficulty === 'Facile' ? Colors.secondary : recipe.difficulty === 'Moyen' ? Colors.accent : Colors.error }]}>{recipe.difficulty}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Quick actions */}
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Pressable style={[styles.quickAction, { backgroundColor: Colors.primary }]} onPress={() => router.push('/create-recipe')}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Nouvelle recette</Text>
            </Pressable>
            <Pressable style={[styles.quickAction, { backgroundColor: Colors.secondary }]} onPress={() => router.push('/create-list')}>
              <MaterialIcons name="playlist-add" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Nouvelle liste</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { position: 'relative', height: 220 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { padding: Spacing.lg, flex: 1, justifyContent: 'flex-end' },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  heroTitle: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: 4, lineHeight: 28 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  seeAll: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  activeListCard: { borderRadius: Radius.md, padding: Spacing.md, borderLeftWidth: 4 },
  activeListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  activeListName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  activeListSup: { fontSize: FontSize.xs, marginTop: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
  countBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  progressBar: { height: 6, borderRadius: Radius.round, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.round },
  progressText: { fontSize: FontSize.xs },
  favoriteCard: { width: 140, borderRadius: Radius.md, padding: Spacing.sm },
  favoriteEmoji: { width: '100%', height: 80, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm, overflow: 'hidden' },
  favoriteTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, lineHeight: 18 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  recipeRowIcon: { width: 48, height: 48, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, overflow: 'hidden' },
  recipeRowTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.round },
  diffText: { fontSize: 10, fontWeight: FontWeight.bold },
  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.md },
  quickActionText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
