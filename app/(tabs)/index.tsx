//////////////////////////////////////////////////////////////////////////
//                             Index.tsx                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran d'accueil : favoris, aperçu des courses et suggestions de recettes (le bloc IA existe mais reste désactivé, cf. AI_RECOMMENDATIONS_ENABLED ci-dessous).
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { SUPERMARKETS } from '@/constants/config';
import { Recipe, PublicRecipe } from '@/services/kitchenService';
import { getFollowedUserIds } from '@/services/social/followService';
import { ScreenContainer } from '@/components/ScreenContainer';

// La fonction Edge "recommend-recipes" dépendait d'une clé IA propriétaire OnSpace,
// désactivée en attendant qu'un fournisseur IA propre au projet soit configuré.
const AI_RECOMMENDATIONS_ENABLED = false;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors, isDark } = useAppTheme();
  const { recipes, publicRecipes, shoppingLists, preferences, loading, addRecipe } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      void getFollowedUserIds(user.id).then(ids => setFollowedUserIds(ids));
    }
  }, [user?.id]);

  // Personalized scoring
  const getPreferenceScore = useCallback((recipe: Recipe | PublicRecipe): number => {
    let score = 0;
    const ingLower = recipe.ingredients.map(i => i.name.toLowerCase());
    const tagLower = recipe.tags.map(t => t.toLowerCase());

    for (const liked of preferences.likedIngredients) {
      if (ingLower.some(n => n.includes(liked.toLowerCase()))) score += 2;
    }
    for (const disliked of preferences.dislikedIngredients) {
      if (ingLower.some(n => n.includes(disliked.toLowerCase()))) score -= 3;
    }
    for (const allergy of preferences.allergies) {
      if (ingLower.some(n => n.includes(allergy.toLowerCase()))) score -= 10;
    }
    for (const dietTag of preferences.dietaryTags) {
      const terms: Record<string, string[]> = {
        vegetarian: ['végétarien', 'vegetarian'], vegan: ['vegan'],
        glutenfree: ['sans gluten'], dairyfree: ['sans lactose'],
      };
      const check = terms[dietTag] ?? [dietTag];
      if (check.some(term => tagLower.some(t => t.includes(term)))) score += 1;
    }
    return score;
  }, [preferences]);

  const personalized = useMemo(() => {
    const hasPrefs = preferences.likedIngredients.length > 0 || preferences.dietaryTags.length > 0;
    if (!hasPrefs) return recipes.slice(0, 5);
    return [...recipes]
      .map(r => ({ recipe: r, score: getPreferenceScore(r) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ recipe }) => recipe);
  }, [recipes, getPreferenceScore, preferences]);

  const communityForYou = useMemo(() => {
    const hasPrefs = preferences.likedIngredients.length > 0;
    const sorted = [...publicRecipes]
      .map(r => ({ recipe: r, score: getPreferenceScore(r) + (followedUserIds.includes(r.authorId ?? '') ? 5 : 0) }))
      .filter(({ score }) => score >= 0 || !hasPrefs)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ recipe }) => recipe);
    return sorted;
  }, [publicRecipes, getPreferenceScore, preferences, followedUserIds]);

  const activeList = useMemo(() => shoppingLists[0], [shoppingLists]);
  const uncheckedCount = useMemo(() => activeList?.items.filter(i => !i.checked).length ?? 0, [activeList]);
  const getSupermarket = (smId: string) => SUPERMARKETS.find(s => s.id === smId) || SUPERMARKETS[SUPERMARKETS.length - 1];

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
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb.functions.invoke('recommend-recipes', {
        body: { preferences, existingRecipeTitles: recipes.map(r => r.title), count: 3 },
      });
      if (error) { showAlert('Recommandations IA', "Impossible de générer des recommandations pour l'instant."); return; }
      setAiRecipes(data?.recipes ?? []);
      setAiLoaded(true);
    } catch { showAlert('Erreur', "Une erreur est survenue."); }
    finally { setAiLoading(false); }
  }, [preferences, recipes, aiLoading, showAlert]);

  const handleSaveAIRecipe = useCallback(async (aiRecipe: any) => {
    await addRecipe({
      title: aiRecipe.title, description: aiRecipe.description,
      ingredients: aiRecipe.ingredients.map((ing: any, i: number) => ({ ...ing, id: `ing_${Date.now()}_${i}` })),
      steps: aiRecipe.steps, tags: aiRecipe.tags, duration: aiRecipe.duration,
      servings: aiRecipe.servings, difficulty: aiRecipe.difficulty, isFavorite: false, isPublic: false,
    });
    setAiRecipes(prev => prev.filter(r => r.title !== aiRecipe.title));
    showAlert('Recette ajoutée !', `"${aiRecipe.title}" a été ajoutée à vos recettes.`);
  }, [addRecipe, showAlert]);

  const Shadow = {
    sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + Spacing.sm }]}>
        <Image source={require('@/assets/images/hero-kitchen.jpg')} style={styles.heroImage} contentFit="cover" transition={300} />
        <View style={[styles.heroOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(44,24,16,0.50)' }]} />
        <View style={styles.heroContent}>
          <Text style={styles.greeting}>{greeting}{userName ? ` ${userName}` : ''} 👨‍🍳</Text>
          <Text style={styles.heroTitle}>{"Qu'est-ce qu'on cuisine aujourd'hui ?"}</Text>
          {preferences.likedIngredients.length > 0 ? (
            <View style={styles.heroPrefRow}>
              <MaterialIcons name="favorite" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroPrefText} numberOfLines={1}>
                {preferences.likedIngredients.slice(0, 3).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScreenContainer style={{ padding: Spacing.md }}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'menu-book', color: Colors.primary, count: recipes.length, label: 'Recettes', route: '/(tabs)/recipes' },
            { icon: 'shopping-cart', color: Colors.secondary, count: shoppingLists.length, label: 'Listes', route: '/(tabs)/shopping' },
            { icon: 'favorite', color: '#FF6B6B', count: recipes.filter(r => r.isFavorite).length, label: 'Favoris', route: '/(tabs)/recipes' },
          ].map(s => (
            <Pressable key={s.label} style={[styles.statCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(s.route as any)}>
              <MaterialIcons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statNumber, { color: Colors.text }]}>{s.count}</Text>
              <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Pour vous - Personalized */}
        {personalized.length > 0 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Pour vous ✨</Text>
                {preferences.likedIngredients.length > 0 ? (
                  <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Basé sur vos préférences</Text>
                ) : null}
              </View>
              <Pressable onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={[styles.seeAll, { color: Colors.primary }]}>Voir tout</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {personalized.map(recipe => (
                <Pressable key={recipe.id} style={[styles.forYouCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                  <View style={[styles.forYouImage, { backgroundColor: Colors.surfaceMuted }]}>
                    {recipe.image
                      ? <Image source={{ uri: recipe.image }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                      : <Text style={{ fontSize: 32 }}>🍽️</Text>}
                    {recipe.isFavorite ? (
                      <View style={styles.favBadge}><MaterialIcons name="favorite" size={12} color="#FF6B6B" /></View>
                    ) : null}
                  </View>
                  <View style={{ padding: Spacing.sm }}>
                    <Text style={[styles.forYouTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MaterialIcons name="schedule" size={11} color={Colors.textMuted} />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{recipe.duration} min</Text>
                      <View style={[styles.diffChip, {
                        backgroundColor: recipe.difficulty === 'Facile' ? '#E8F5E9' : recipe.difficulty === 'Moyen' ? '#FFF3E0' : '#FFEBEE',
                      }]}>
                        <Text style={[styles.diffText, {
                          color: recipe.difficulty === 'Facile' ? Colors.secondary : recipe.difficulty === 'Moyen' ? Colors.accent : Colors.error,
                        }]}>{recipe.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Community */}
        {communityForYou.length > 0 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Communauté 🌍</Text>
                {followedUserIds.length > 0 ? (
                  <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Recettes de vos abonnements en priorité</Text>
                ) : null}
              </View>
              <Pressable onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={[styles.seeAll, { color: Colors.primary }]}>Explorer</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {communityForYou.map(recipe => (
                <View key={recipe.id} style={[styles.communityCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
                  <View style={[styles.communityImage, { backgroundColor: Colors.surfaceMuted }]}>
                    {recipe.image ? <Image source={{ uri: recipe.image }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Text style={{ fontSize: 28 }}>🍽️</Text>}
                  </View>
                  <View style={{ padding: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <View style={[styles.authorDot, { backgroundColor: Colors.primary + '20' }]}>
                        <MaterialIcons name="person" size={11} color={Colors.primary} />
                      </View>
                      <Text style={[styles.authorLabel, { color: Colors.primary }]} numberOfLines={1}>{recipe.authorName}</Text>
                      {followedUserIds.includes(recipe.authorId ?? '') ? (
                        <MaterialIcons name="check-circle" size={12} color={Colors.secondary} />
                      ) : null}
                    </View>
                    <Text style={[styles.communityTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MaterialIcons name="schedule" size={11} color={Colors.textMuted} />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{recipe.duration} min</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* AI recommendations */}
        {AI_RECOMMENDATIONS_ENABLED ? (
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recommandations IA 🤖</Text>
              <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Recettes générées selon vos goûts</Text>
            </View>
            <Pressable
              style={[styles.generateBtn, { backgroundColor: aiLoading ? Colors.surfaceMuted : Colors.primary + '15', borderColor: Colors.primary + '30' }]}
              onPress={() => void fetchAIRecommendations()}
              disabled={aiLoading}
            >
              {aiLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />}
              <Text style={[styles.generateBtnText, { color: Colors.primary }]}>{aiLoading ? '...' : aiLoaded ? 'Rafraîchir' : 'Générer'}</Text>
            </Pressable>
          </View>

          {aiLoading ? (
            <View style={[styles.aiLoadingCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={[styles.aiLoadingText, { color: Colors.textSubtle }]}>{"L'IA prépare vos recommandations..."}</Text>
            </View>
          ) : aiRecipes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {aiRecipes.map((recipe: any, idx: number) => (
                <View key={`${recipe.title}-${idx}`} style={[styles.aiCard, { backgroundColor: Colors.surface, borderColor: Colors.primary + '20', ...Shadow.sm }]}>
                  <View style={[styles.aiBadge, { backgroundColor: Colors.primary }]}>
                    <MaterialIcons name="auto-awesome" size={10} color="#fff" />
                    <Text style={styles.aiBadgeText}>IA</Text>
                  </View>
                  <Text style={[styles.aiCardTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                  <Text style={[styles.aiCardDesc, { color: Colors.textSubtle }]} numberOfLines={2}>{recipe.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
                    <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min</Text>
                    <View style={[styles.diffChip, { backgroundColor: Colors.secondary + '15' }]}>
                      <Text style={[styles.diffText, { color: Colors.secondary }]}>{recipe.difficulty}</Text>
                    </View>
                  </View>
                  <Pressable style={[styles.aiSaveBtn, { backgroundColor: Colors.primary }]} onPress={() => void handleSaveAIRecipe(recipe)}>
                    <MaterialIcons name="add" size={15} color="#fff" />
                    <Text style={styles.aiSaveBtnText}>Ajouter</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Pressable style={[styles.aiEmptyCard, { backgroundColor: Colors.surface, borderColor: Colors.primary + '20', ...Shadow.sm }]} onPress={() => void fetchAIRecommendations()}>
              <MaterialIcons name="auto-awesome" size={30} color={Colors.primary + '80'} />
              <Text style={[styles.aiEmptyTitle, { color: Colors.text }]}>Générer des recettes IA</Text>
              <Text style={[styles.aiEmptyDesc, { color: Colors.textSubtle }]}>Personnalisées selon vos préférences</Text>
            </Pressable>
          )}
        </View>
        ) : null}

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
                <View style={[styles.progressFill, { backgroundColor: activeList.color, width: `${activeList.items.length > 0 ? ((activeList.items.length - uncheckedCount) / activeList.items.length) * 100 : 0}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: Colors.textMuted }]}>{activeList.items.length - uncheckedCount} / {activeList.items.length} cochés</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Quick actions */}
        <View style={{ marginBottom: Spacing.sm }}>
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
      </ScreenContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'relative', height: 230 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { padding: Spacing.lg, flex: 1, justifyContent: 'flex-end' },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  heroTitle: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: 4, lineHeight: 28 },
  heroPrefRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  heroPrefText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sectionHint: { fontSize: FontSize.xs, marginTop: 2 },
  seeAll: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, paddingTop: 4 },

  forYouCard: { width: 150, borderRadius: Radius.lg, overflow: 'hidden' },
  forYouImage: { height: 110, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  favBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 3 },
  forYouTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, lineHeight: 18 },
  diffChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.round },
  diffText: { fontSize: 9, fontWeight: FontWeight.bold },

  communityCard: { width: 160, borderRadius: Radius.lg, overflow: 'hidden' },
  communityImage: { height: 100, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  authorDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  authorLabel: { fontSize: 10, fontWeight: FontWeight.semibold, flex: 1 },
  communityTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, lineHeight: 18 },

  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.round, borderWidth: 1, marginTop: 2, minWidth: 100, justifyContent: 'center' },
  generateBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  aiLoadingCard: { borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, flexDirection: 'row', justifyContent: 'center' },
  aiLoadingText: { fontSize: FontSize.md },
  aiEmptyCard: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderStyle: 'dashed' },
  aiEmptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  aiEmptyDesc: { fontSize: FontSize.sm, textAlign: 'center' },
  aiCard: { width: 210, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5, position: 'relative' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, position: 'absolute', top: 10, right: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.round },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
  aiCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: 22, marginBottom: 4, lineHeight: 20 },
  aiCardDesc: { fontSize: FontSize.xs, lineHeight: 18, marginBottom: Spacing.sm },
  aiSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: Radius.md },
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

  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.md },
  quickActionText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
