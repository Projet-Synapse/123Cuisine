// Powered by OnSpace.AI
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, FlatList,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth, useAlert } from '@/template';
import { useKitchen } from '@/hooks/useKitchen';
import {
  FullUserProfile, PublicUserRecipe,
  getUserProfileDetails, getUserPublicRecipes,
  followUser, unfollowUser,
} from '@/services/followService';
import { rateRecipe, getMyRatingForRecipe, getRecipesRatingStats, RecipeRatingStats } from '@/services/ratingService';

const AVATAR_COLORS = ['#C0705A', '#6B8F71', '#5E7A8A', '#D4824A', '#7E5A8A', '#3A8A72', '#B0405A', '#4A5EA0'];

function getAvatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(profile: FullUserProfile | null): string {
  if (!profile) return '?';
  const name = profile.username || profile.email;
  return name.split(/[@.\s]/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function StarRating({ value, onRate, size = 18, readonly = false }: {
  value: number | null; onRate?: (r: number) => void; size?: number; readonly?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable key={star} onPress={() => !readonly && onRate?.(star)} hitSlop={4} disabled={readonly}>
          <MaterialIcons
            name={value !== null && value >= star ? 'star' : 'star-border'}
            size={size}
            color={value !== null && value >= star ? '#F5A623' : '#CCCCCC'}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { id: profileUserId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { shoppingLists, addRecipeToList, playlists, updatePlaylist, addRecipe } = useKitchen();

  const [profile, setProfile] = useState<FullUserProfile | null>(null);
  const [recipes, setRecipes] = useState<PublicUserRecipe[]>([]);
  const [ratingStats, setRatingStats] = useState<Record<string, RecipeRatingStats>>({});
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<PublicUserRecipe | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const isOwnProfile = user?.id === profileUserId;

  useEffect(() => {
    loadData();
  }, [profileUserId]);

  const loadData = async () => {
    setLoading(true);
    const [prof, recs] = await Promise.all([
      getUserProfileDetails(profileUserId, user?.id),
      getUserPublicRecipes(profileUserId),
    ]);
    setProfile(prof);
    setRecipes(recs);
    if (recs.length > 0) {
      const stats = await getRecipesRatingStats(recs.map(r => r.id));
      setRatingStats(stats);
    }
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!user) { showAlert('Connexion requise', 'Connectez-vous pour suivre des utilisateurs.'); return; }
    if (!profile) return;
    setFollowLoading(true);
    const ok = profile.isFollowing
      ? await unfollowUser(profile.id)
      : await followUser(profile.id);
    if (ok) {
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followerCount: prev.followerCount + (prev.isFollowing ? -1 : 1),
      } : null);
    }
    setFollowLoading(false);
  };

  const handleSelectRecipe = async (recipe: PublicUserRecipe) => {
    setSelectedRecipe(recipe);
    setMyRating(null);
    if (user && !isOwnProfile) {
      const r = await getMyRatingForRecipe(recipe.id);
      setMyRating(r);
    }
  };

  const handleRate = async (rating: number) => {
    if (!user) { showAlert('Connexion requise', 'Notez les recettes après connexion.'); return; }
    if (!selectedRecipe) return;
    setRatingLoading(true);
    const ok = await rateRecipe(selectedRecipe.id, rating);
    if (ok) {
      setMyRating(rating);
      const stats = await getRecipesRatingStats([selectedRecipe.id]);
      setRatingStats(prev => ({ ...prev, ...stats }));
    }
    setRatingLoading(false);
  };

  const handleAddToList = (recipe: PublicUserRecipe) => {
    if (!user) { showAlert('Connexion requise', ''); return; }
    if (shoppingLists.length === 0) { showAlert('Aucune liste', "Créez d'abord une liste de courses."); return; }
    showAlert('Ajouter à une liste', '', [
      ...shoppingLists.map(l => ({
        text: l.name,
        onPress: async () => {
          await addRecipeToList(l.id, recipe as any);
          showAlert('Ajouté !', `Ingrédients ajoutés à "${l.name}".`);
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const handleSaveToCollection = async (recipe: PublicUserRecipe) => {
    if (!user) { showAlert('Connexion requise', ''); return; }
    setSavingRecipe(true);
    await addRecipe({
      title: recipe.title, description: recipe.description,
      ingredients: recipe.ingredients, steps: recipe.steps, tags: recipe.tags,
      duration: recipe.duration, servings: recipe.servings,
      difficulty: recipe.difficulty, isFavorite: false, image: recipe.image,
    });
    setSavingRecipe(false);
    showAlert('Copié !', 'La recette a été ajoutée à votre collection.');
  };

  const handleAddToPlaylist = (recipe: PublicUserRecipe) => {
    if (!user) { showAlert('Connexion requise', ''); return; }
    if (playlists.length === 0) { showAlert('Aucune playlist', "Créez d'abord une playlist."); return; }
    showAlert('Ajouter à une playlist', '', [
      ...playlists.map(pl => ({
        text: pl.name,
        onPress: async () => {
          const ids = pl.recipeIds.includes(recipe.id) ? pl.recipeIds : [...pl.recipeIds, recipe.id];
          await updatePlaylist({ ...pl, recipeIds: ids });
          showAlert('Ajouté !', `Recette ajoutée à "${pl.name}".`);
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };
  const avatarColor = profile ? getAvatarColor(profile.id) : Colors.primary;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md }}>
        <Text style={{ color: Colors.text, fontSize: FontSize.lg }}>Profil introuvable</Text>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: Colors.primary }]}>
          <Text style={{ color: '#fff', fontWeight: FontWeight.semibold }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const renderRecipeCard = ({ item, index }: { item: PublicUserRecipe; index: number }) => {
    const stats = ratingStats[item.id];
    return (
      <Pressable
        style={[styles.recipeCard, { backgroundColor: Colors.surface, ...Shadow.sm }, index % 2 === 0 ? { marginRight: 6 } : { marginLeft: 6 }]}
        onPress={() => handleSelectRecipe(item)}
      >
        <View style={[styles.recipeCardImg, { backgroundColor: Colors.surfaceMuted }]}>
          {item.image
            ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            : <Text style={{ fontSize: 32 }}>🍽️</Text>}
          <View style={[styles.diffBadge, { backgroundColor: item.difficulty === 'Facile' ? '#4CAF5090' : item.difficulty === 'Moyen' ? '#F57C0090' : '#E5393590' }]}>
            <Text style={styles.diffText}>{item.difficulty}</Text>
          </View>
        </View>
        <View style={styles.recipeCardBody}>
          <Text style={[styles.recipeCardTitle, { color: Colors.text }]} numberOfLines={2}>{item.title}</Text>
          <View style={styles.recipeCardMeta}>
            <MaterialIcons name="schedule" size={11} color={Colors.textMuted} />
            <Text style={[styles.recipeCardMetaText, { color: Colors.textMuted }]}>{item.duration} min</Text>
          </View>
          {stats ? (
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={12} color="#F5A623" />
              <Text style={[styles.ratingText, { color: Colors.textMuted }]}>{stats.avg} ({stats.count})</Text>
            </View>
          ) : (
            <Text style={[styles.ratingText, { color: Colors.textMuted }]}>Pas encore noté</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>
          {profile.username || profile.email.split('@')[0]}
        </Text>
        {!isOwnProfile ? (
          <Pressable
            style={[styles.followBtn, { backgroundColor: profile.isFollowing ? Colors.surfaceMuted : Colors.primary, borderColor: profile.isFollowing ? Colors.border : Colors.primary }]}
            onPress={handleFollow} disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator size="small" color={profile.isFollowing ? Colors.text : '#fff'} />
              : (
                <>
                  <MaterialIcons name={profile.isFollowing ? 'person-remove' : 'person-add'} size={14} color={profile.isFollowing ? Colors.text : '#fff'} />
                  <Text style={[styles.followBtnText, { color: profile.isFollowing ? Colors.text : '#fff' }]}>
                    {profile.isFollowing ? 'Suivi' : 'Suivre'}
                  </Text>
                </>
              )}
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={recipes}
        numColumns={2}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 60 }}
        ListHeaderComponent={(
          <View>
            {/* Profile hero */}
            <View style={[styles.heroCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{getInitials(profile)}</Text>
              </View>
              <Text style={[styles.displayName, { color: Colors.text }]}>
                {profile.username || profile.email.split('@')[0]}
              </Text>
              {profile.username ? (
                <Text style={[styles.emailText, { color: Colors.textSubtle }]}>{profile.email}</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.text }]}>{profile.publicRecipeCount}</Text>
                  <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>recettes</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.text }]}>{profile.followerCount}</Text>
                  <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>abonnés</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.text }]}>{profile.followingCount}</Text>
                  <Text style={[styles.statLabel, { color: Colors.textSubtle }]}>abonnements</Text>
                </View>
              </View>
            </View>

            {/* Recipes header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recettes publiées</Text>
              {recipes.length > 0 ? (
                <View style={[styles.countPill, { backgroundColor: Colors.primary + '15' }]}>
                  <Text style={[styles.countPillText, { color: Colors.primary }]}>{recipes.length}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        renderItem={renderRecipeCard}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>👨‍🍳</Text>
            <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucune recette publique</Text>
            <Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>
              {isOwnProfile ? 'Publiez une recette pour la partager avec la communauté.' : 'Cet utilisateur n\'a pas encore partagé de recettes.'}
            </Text>
          </View>
        )}
      />

      {/* Recipe detail modal */}
      {selectedRecipe ? (
        <View style={StyleSheet.absoluteFillObject}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedRecipe(null)} />
          <View style={[styles.recipeModal, { backgroundColor: Colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />

            {/* Image */}
            <View style={[styles.modalImage, { backgroundColor: Colors.surfaceMuted }]}>
              {selectedRecipe.image
                ? <Image source={{ uri: selectedRecipe.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                : <Text style={{ fontSize: 48 }}>🍽️</Text>}
              <Pressable style={styles.modalClose} onPress={() => setSelectedRecipe(null)}>
                <MaterialIcons name="close" size={20} color="#fff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>{selectedRecipe.title}</Text>
              {selectedRecipe.description ? (
                <Text style={[styles.modalDesc, { color: Colors.textSubtle }]}>{selectedRecipe.description}</Text>
              ) : null}

              {/* Meta */}
              <View style={styles.modalMeta}>
                <View style={styles.metaChip}>
                  <MaterialIcons name="schedule" size={13} color={Colors.textMuted} />
                  <Text style={[styles.metaChipText, { color: Colors.textMuted }]}>{selectedRecipe.duration} min</Text>
                </View>
                <View style={styles.metaChip}>
                  <MaterialIcons name="people" size={13} color={Colors.textMuted} />
                  <Text style={[styles.metaChipText, { color: Colors.textMuted }]}>{selectedRecipe.servings} pers.</Text>
                </View>
                <View style={[styles.metaChip, { backgroundColor: Colors.surfaceMuted }]}>
                  <Text style={[styles.metaChipText, { color: Colors.textSubtle }]}>{selectedRecipe.difficulty}</Text>
                </View>
              </View>

              {/* Tags */}
              {selectedRecipe.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {selectedRecipe.tags.slice(0, 4).map(tag => (
                    <View key={tag} style={[styles.tagChip, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}>
                      <Text style={[styles.tagChipText, { color: Colors.primary }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Rating */}
              <View style={[styles.ratingSection, { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.lg }]}>
                {ratingStats[selectedRecipe.id] ? (
                  <View style={styles.avgRatingRow}>
                    <StarRating value={Math.round(ratingStats[selectedRecipe.id].avg)} size={20} readonly />
                    <Text style={[styles.avgRatingText, { color: Colors.text }]}>
                      {ratingStats[selectedRecipe.id].avg} sur 5 ({ratingStats[selectedRecipe.id].count} avis)
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.noRatingText, { color: Colors.textMuted }]}>Pas encore noté</Text>
                )}

                {user && !isOwnProfile ? (
                  <View style={styles.myRatingRow}>
                    <Text style={[styles.myRatingLabel, { color: Colors.textSubtle }]}>Votre note :</Text>
                    {ratingLoading
                      ? <ActivityIndicator size="small" color={Colors.primary} />
                      : <StarRating value={myRating} onRate={handleRate} size={24} />}
                  </View>
                ) : null}
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                {user && !isOwnProfile ? (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: Colors.secondary + '15', borderColor: Colors.secondary + '40' }]}
                    onPress={() => handleSaveToCollection(selectedRecipe)}
                    disabled={savingRecipe}
                  >
                    {savingRecipe
                      ? <ActivityIndicator size="small" color={Colors.secondary} />
                      : <MaterialIcons name="bookmark-add" size={18} color={Colors.secondary} />}
                    <Text style={[styles.actionBtnText, { color: Colors.secondary }]}>Copier dans ma collection</Text>
                  </Pressable>
                ) : null}
                {user ? (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: Colors.accent + '15', borderColor: Colors.accent + '40' }]}
                    onPress={() => handleAddToList(selectedRecipe)}
                  >
                    <MaterialIcons name="shopping-cart" size={18} color={Colors.accent} />
                    <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Ajouter à ma liste</Text>
                  </Pressable>
                ) : null}
                {user ? (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
                    onPress={() => handleAddToPlaylist(selectedRecipe)}
                  >
                    <MaterialIcons name="playlist-add" size={18} color={Colors.primary} />
                    <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Ajouter à une playlist</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.round,
    borderWidth: 1, minWidth: 80, justifyContent: 'center',
  },
  followBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  backBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 12, borderRadius: Radius.md },

  heroCard: { borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: FontWeight.bold },
  displayName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
  emailText: { fontSize: FontSize.xs, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.sm },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs },
  statDivider: { width: 1, height: 30 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1 },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
  countPillText: { fontSize: 12, fontWeight: FontWeight.bold },

  recipeCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md },
  recipeCardImg: { height: 110, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  diffBadge: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.round },
  diffText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  recipeCardBody: { padding: Spacing.sm },
  recipeCardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 4 },
  recipeCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recipeCardMetaText: { fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ratingText: { fontSize: 11 },

  emptyState: { alignItems: 'center', paddingTop: 40, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  recipeModal: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%', flexDirection: 'column',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  modalImage: { height: 180, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  modalClose: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: 6,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 6 },
  modalDesc: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  modalMeta: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.round },
  metaChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: FontWeight.semibold },
  ratingSection: { padding: Spacing.md, marginBottom: Spacing.md },
  avgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avgRatingText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  noRatingText: { fontSize: FontSize.sm, fontStyle: 'italic' },
  myRatingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  myRatingLabel: { fontSize: FontSize.sm },
  modalActions: { gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
});
