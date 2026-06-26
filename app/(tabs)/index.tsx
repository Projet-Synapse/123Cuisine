// Powered by OnSpace.AI
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { SUPERMARKETS } from '@/constants/config';
import { Recipe } from '@/services/kitchenService';

interface AIRecipe {
  title: string;
  description: string;
  ingredients: { id: string; name: string; quantity: string; unit: string; category: string }[];
  steps: string[];
  tags: string[];
  duration: number;
  servings: number;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors, isDark } = useAppTheme();
  const { recipes, shoppingLists, preferences, loading, addRecipe } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [aiRecipes, setAiRecipes] = useState<AIRecipe[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);

  const favoriteRecipes = useMemo(() => recipes.filter(r => r.isFavorite), [recipes]);
  const recentRecipes = useMemo(() => [...recipes].slice(0, 4), [recipes]);
  const activeList = useMemo(() => shoppingLists[0], [shoppingLists]);
  const uncheckedCount = useMemo(() => activeList?.items.filter(i => !i.checked).length ?? 0, [activeList]);

  const getSupermarket = (id: string) => SUPERMARKETS.find(s => s.id === id) || SUPERMARKETS[SUPERMARKETS.length - 1];

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  // Greeting based on hour
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  const userName = user?.email?.split('@')[0] ?? null;

  const fetchAIRecommendations = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiLoaded(false);
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb.functions.invoke('recommend-recipes', {
        body: {
          preferences,
          existingRecipeTitles: recipes.map(r => r.title),
          count: 3,
        },
      });
      if (error) {
        console.error('[AI Recommendations] Error:', error);
        showAlert('Recommandations IA', "Impossible de générer des recommandations pour l'instant.");
        return;
      }
      setAiRecipes(data?.recipes ?? []);
      setAiLoaded(true);
    } catch (e) {
      console.error('[AI Recommendations] Exception:', e);
      showAlert('Erreur', "Une erreur est survenue lors de la génération.");
    } finally {
      setAiLoading(false);
    }
  }, [preferences, recipes, aiLoading, showAlert]);

  const handleSaveAIRecipe = useCallback(async (aiRecipe: AIRecipe) => {
    await addRecipe({
      title: aiRecipe.title,
      description: aiRecipe.description,
      ingredients: aiRecipe.ingredients.map((ing, i) => ({ ...ing, id: `ing_${Date.now()}_${i}` })),
      steps: aiRecipe.steps,
      tags: aiRecipe.tags,
      duration: aiRecipe.duration,
      servings: aiRecipe.servings,
      difficulty: aiRecipe.difficulty,
      isFavorite: false,
      isPublic: false,
    });
    setAiRecipes(prev => prev.filter(r => r.title !== aiRecipe.title));
    showAlert('Recette ajoutée !', `"${aiRecipe.title}" a été ajoutée à vos recettes.`);
  }, [addRecipe, showAlert]);

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
      {/* ── HERO ── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Image
          source={require('@/assets/images/hero-kitchen.jpg')}
          style={styles.heroImage}
          contentFit="cover"
          transition={300}
        />
        <View style={[styles.heroOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(44,24,16,0.45)' }]} />
        <View style={styles.heroContent}>
          <Text style={styles.greeting}>
            {greeting}{userName ? ` ${userName}` : ''} 👨‍🍳
          </Text>
          <Text style={styles.heroTitle}>{"Qu'est-ce qu'on cuisine aujourd'hui ?"}</Text>
        </View>
      </View>

      <View style={{ padding: Spacing.md }}>

        {/* ── STATS ── */}
        <View style={styles.statsRow}>
          {[
            { icon: 'menu-book', color: Colors.primary, count: recipes.length, label: 'Recettes', route: '/(tabs)/recipes' },
            { icon: 'shopping-cart', color: Colors.secondary, count: shoppingLists.length, label: 'Listes', route: '/(tabs)/shopping' },
            { icon: 'favorite', color: Colors.accent, count: favoriteRecipes.length, label: 'Favoris', route: '/(tabs)/recipes' },
          ].map(s => (
            <Pressable
              key={s.label}
              style={[styles.statCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}
              onPress={() => router.push(s.route as any)}
            >
              <MaterialIcons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statNumber, { color: Colors.text }]}>{s.count}</Text>
              <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── AI RECOMMENDATIONS ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>✨ Recommandations IA</Text>
              <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>
                Générées selon vos préférences
              </Text>
            </View>
            <Pressable
              style={[
                styles.generateBtn,
                { backgroundColor: aiLoading ? Colors.surfaceMuted : Colors.primary + '15', borderColor: Colors.primary + '30' },
              ]}
              onPress={fetchAIRecommendations}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} />
              )}
              <Text style={[styles.generateBtnText, { color: Colors.primary }]}>
                {aiLoading ? 'Génération...' : aiLoaded ? 'Regénérer' : 'Générer'}
              </Text>
            </Pressable>
          </View>

          {/* AI Recipe Cards */}
          {aiLoading ? (
            <View style={[styles.aiLoadingCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={[styles.aiLoadingText, { color: Colors.textSubtle }]}>
                {"L'IA prépare vos recommandations..."}
              </Text>
            </View>
          ) : aiRecipes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {aiRecipes.map((recipe, idx) => (
                <View key={`${recipe.title}-${idx}`} style={[styles.aiCard, { backgroundColor: Colors.surface, borderColor: Colors.primary + '20', ...Shadow.sm }]}>
                  {/* AI badge */}
                  <View style={[styles.aiBadge, { backgroundColor: Colors.primary }]}>
                    <MaterialIcons name="auto-awesome" size={11} color="#fff" />
                    <Text style={styles.aiBadgeText}>IA</Text>
                  </View>

                  <Text style={[styles.aiCardTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                  <Text style={[styles.aiCardDesc, { color: Colors.textSubtle }]} numberOfLines={2}>{recipe.description}</Text>

                  {/* Meta */}
                  <View style={styles.aiCardMeta}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                      <Text style={[styles.metaText, { color: Colors.textMuted }]}>{recipe.duration} min</Text>
                    </View>
                    <View style={[styles.diffBadge, {
                      backgroundColor:
                        recipe.difficulty === 'Facile' ? Colors.secondary + '15' :
                        recipe.difficulty === 'Moyen' ? Colors.accent + '15' : Colors.error + '15',
                    }]}>
                      <Text style={[styles.diffText, {
                        color:
                          recipe.difficulty === 'Facile' ? Colors.secondary :
                          recipe.difficulty === 'Moyen' ? Colors.accent : Colors.error,
                      }]}>{recipe.difficulty}</Text>
                    </View>
                  </View>

                  {/* Tags */}
                  {recipe.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {recipe.tags.slice(0, 2).map(tag => (
                        <View key={tag} style={[styles.tagChip, { backgroundColor: Colors.surfaceMuted }]}>
                          <Text style={[styles.tagText, { color: Colors.textSubtle }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Add button */}
                  <Pressable
                    style={[styles.aiSaveBtn, { backgroundColor: Colors.primary }]}
                    onPress={() => handleSaveAIRecipe(recipe)}
                  >
                    <MaterialIcons name="add" size={16} color="#fff" />
                    <Text style={styles.aiSaveBtnText}>Ajouter à mes recettes</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Pressable
              style={[styles.aiEmptyCard, { backgroundColor: Colors.surface, borderColor: Colors.primary + '25', ...Shadow.sm }]}
              onPress={fetchAIRecommendations}
            >
              <MaterialIcons name="auto-awesome" size={32} color={Colors.primary + '80'} />
              <Text style={[styles.aiEmptyTitle, { color: Colors.text }]}>Générer des recettes IA</Text>
              <Text style={[styles.aiEmptyDesc, { color: Colors.textSubtle }]}>
                {"Appuyez pour obtenir des recettes\npersonnalisées selon vos goûts"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── ACTIVE LIST ── */}
        {activeList ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Liste en cours</Text>
            <Pressable
              style={[styles.activeListCard, { backgroundColor: Colors.surface, borderLeftColor: activeList.color, ...Shadow.sm }]}
              onPress={() => router.push(`/list/${activeList.id}`)}
            >
              <View style={styles.activeListHeader}>
                <View>
                  <Text style={[styles.activeListName, { color: Colors.text }]}>{activeList.name}</Text>
                  <Text style={[styles.activeListSup, { color: Colors.textSubtle }]}>
                    {getSupermarket(activeList.supermarketId).name}
                  </Text>
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
              <Text style={[styles.progressText, { color: Colors.textMuted }]}>
                {activeList.items.length - uncheckedCount} / {activeList.items.length} cochés
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── FAVORITES ── */}
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
                <Pressable
                  key={recipe.id}
                  style={[styles.favoriteCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
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

        {/* ── RECENT RECIPES ── */}
        {recentRecipes.length > 0 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Mes recettes</Text>
              <Pressable onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={[styles.seeAll, { color: Colors.primary }]}>Voir plus</Text>
              </Pressable>
            </View>
            {recentRecipes.map(recipe => (
              <Pressable
                key={recipe.id}
                style={[styles.recipeRow, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              >
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
                  backgroundColor:
                    recipe.difficulty === 'Facile' ? '#E8F5E9' :
                    recipe.difficulty === 'Moyen' ? '#FFF3E0' : '#FFEBEE',
                }]}>
                  <Text style={[styles.diffText, {
                    color:
                      recipe.difficulty === 'Facile' ? Colors.secondary :
                      recipe.difficulty === 'Moyen' ? Colors.accent : Colors.error,
                  }]}>{recipe.difficulty}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── QUICK ACTIONS ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: Colors.primary }]}
              onPress={() => router.push('/create-recipe')}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Nouvelle recette</Text>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: Colors.secondary }]}
              onPress={() => router.push('/create-list')}
            >
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

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  sectionHint: { fontSize: FontSize.xs, marginTop: -4, marginBottom: 4 },
  seeAll: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, paddingTop: 4 },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
    marginTop: 2,
    minWidth: 110,
    justifyContent: 'center',
  },
  generateBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  aiLoadingCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  aiLoadingText: { fontSize: FontSize.md },

  aiEmptyCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  aiEmptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  aiEmptyDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  aiCard: {
    width: 220,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    position: 'relative',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.round,
  },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
  aiCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 24, marginBottom: 4, lineHeight: 20 },
  aiCardDesc: { fontSize: FontSize.xs, lineHeight: 18, marginBottom: Spacing.sm },
  aiCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: FontSize.xs },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round },
  diffText: { fontSize: 10, fontWeight: FontWeight.bold },

  tagRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round },
  tagText: { fontSize: 10 },

  aiSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  aiSaveBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

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

  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.md },
  quickActionText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
