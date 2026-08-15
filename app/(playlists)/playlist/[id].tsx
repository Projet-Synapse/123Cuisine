//////////////////////////////////////////////////////////////////////////
//                            📚 Playlist.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Détail d'une playlist : recettes qu'elle contient, ajout depuis les recettes personnelles ou publiques.
 */

// Powered by OnSpace.AI
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, FlatList, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { Recipe } from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { playlists, recipes, publicRecipes, shoppingLists, deletePlaylist, updatePlaylist, addRecipeToList, addRecipe } = useKitchen();
  const { showAlert } = useAlert();

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addTab, setAddTab] = useState<'mes' | 'communaute'>('mes');
  const [addSearch, setAddSearch] = useState('');

  const playlist = useMemo(() => playlists.find(p => p.id === id), [playlists, id]);
  const playlistRecipes = useMemo(
    () => (playlist?.recipeIds ?? []).map(rid => recipes.find(r => r.id === rid)).filter(Boolean) as Recipe[],
    [playlist, recipes]
  );
  const totalDuration = useMemo(() => playlistRecipes.reduce((a, r) => a + r.duration, 0), [playlistRecipes]);

  const Shadow = {
    sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  };

  if (!playlist) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Playlist introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: Colors.primary }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleDeletePlaylist = () => {
    showAlert('Supprimer la playlist ?', 'Les recettes ne seront pas supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void (async () => { await deletePlaylist(playlist.id); router.back(); })(); } },
    ]);
  };

  const handleRemoveRecipe = (recipe: Recipe) => {
    showAlert('Retirer ?', `"${recipe.title}" sera retiré de la playlist.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void updatePlaylist({ ...playlist, recipeIds: playlist.recipeIds.filter(rid => rid !== recipe.id) }) },
    ]);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const ids = [...playlist.recipeIds];
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    void updatePlaylist({ ...playlist, recipeIds: ids });
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= playlist.recipeIds.length - 1) return;
    const ids = [...playlist.recipeIds];
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    void updatePlaylist({ ...playlist, recipeIds: ids });
  };

  const handleAddAllToList = () => {
    if (shoppingLists.length === 0) { showAlert('Aucune liste', "Créez d'abord une liste de courses."); return; }
    if (playlistRecipes.length === 0) { showAlert('Playlist vide', 'Ajoutez des recettes à cette playlist.'); return; }
    showAlert('Ajouter tous les ingrédients', 'Choisissez une liste :', [
      ...shoppingLists.map(list => ({
        text: list.name,
        onPress: async () => { for (const r of playlistRecipes) await addRecipeToList(list.id, r); showAlert('Ajouté !', `Tous les ingrédients → "${list.name}".`); },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const handleAddRecipeToPlaylist = async (recipe: Recipe) => {
    if (playlist.recipeIds.includes(recipe.id)) {
      showAlert('Déjà présente', `"${recipe.title}" est déjà dans cette playlist.`);
      return;
    }
    await updatePlaylist({ ...playlist, recipeIds: [...playlist.recipeIds, recipe.id] });
  };

  const handleAddCommunityRecipe = async (communityRecipe: any) => {
    showAlert(
      'Copier et ajouter ?',
      `"${communityRecipe.title}" sera copiée dans vos recettes puis ajoutée à cette playlist.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ajouter',
          onPress: () => { void (async () => {
            // We save to collection, then we'll find it by title
            await addRecipe({
              title: communityRecipe.title,
              description: `${communityRecipe.description || ''}\n\n📝 Recette de ${communityRecipe.authorName || 'la communauté'}`,
              ingredients: communityRecipe.ingredients || [],
              steps: communityRecipe.steps || [],
              tags: communityRecipe.tags || [],
              duration: communityRecipe.duration || 30,
              servings: communityRecipe.servings || 4,
              difficulty: communityRecipe.difficulty || 'Facile',
              isFavorite: false,
              isPublic: false,
            });
            showAlert('Recette copiée !', `"${communityRecipe.title}" a été ajoutée à vos recettes et à cette playlist.`);
            setShowAddPanel(false);
          })(); },
        },
      ]
    );
  };

  const formatDuration = (min: number) => min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`;

  // Filtered recipes for the add panel
  const q = addSearch.toLowerCase();
  const availableMyRecipes = recipes.filter(r => !playlist.recipeIds.includes(r.id) && (!q || r.title.toLowerCase().includes(q)));
  const availablePublic = publicRecipes.filter(r => !q || r.title.toLowerCase().includes(q) || (r.authorName || '').toLowerCase().includes(q));

  if (showAddPanel) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        {/* Panel header */}
        <View style={[styles.panelHeader, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => setShowAddPanel(false)} hitSlop={8}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </Pressable>
          <Text style={[styles.panelTitle, { color: Colors.text }]}>Ajouter à la playlist</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScreenContainer style={{ width: '100%' }}>
          <View style={[styles.miniTabBar, { backgroundColor: Colors.surfaceMuted }]}>
            {(['mes', 'communaute'] as const).map(t => (
              <Pressable key={t} style={[styles.miniTabBtn, addTab === t && { backgroundColor: Colors.surface }]} onPress={() => setAddTab(t)}>
                <MaterialIcons name={t === 'mes' ? 'menu-book' : 'public'} size={15} color={addTab === t ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.miniTabText, { color: addTab === t ? Colors.primary : Colors.textMuted }]}>{t === 'mes' ? 'Mes recettes' : 'Communauté'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.addSearchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <MaterialIcons name="search" size={18} color={Colors.textMuted} />
            <TextInput style={[styles.addSearchInput, { color: Colors.text }]} placeholder="Rechercher..." placeholderTextColor={Colors.textMuted} value={addSearch} onChangeText={setAddSearch} />
          </View>
        </ScreenContainer>

        <ScreenContainer style={{ flex: 1, width: '100%' }}>
          <FlatList
            data={addTab === 'mes' ? availableMyRecipes : availablePublic}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.addRecipeRow, { backgroundColor: Colors.surface, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 }]}
                onPress={() => void (addTab === 'mes' ? handleAddRecipeToPlaylist(item as Recipe) : handleAddCommunityRecipe(item))}
              >
                <View style={[styles.addRecipeThumb, { backgroundColor: Colors.surfaceMuted }]}>
                  {(item as any).image ? <Image source={{ uri: (item as any).image }} style={{ width: 54, height: 54 }} contentFit="cover" /> : <Text style={{ fontSize: 24 }}>🍽️</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addRecipeTitle, { color: Colors.text }]} numberOfLines={1}>{item.title}</Text>
                  {addTab === 'communaute' ? <Text style={[styles.addRecipeAuthor, { color: Colors.primary }]}>{(item as any).authorName}</Text> : null}
                  <Text style={[styles.addRecipeMeta, { color: Colors.textMuted }]}>{item.duration} min · {item.difficulty}</Text>
                </View>
                <View style={[styles.addBtnSmall, { backgroundColor: Colors.primary + '15' }]}>
                  <MaterialIcons name="add" size={20} color={Colors.primary} />
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 48, gap: Spacing.sm }}>
                <Text style={{ fontSize: 40 }}>🍽️</Text>
                <Text style={[styles.panelTitle, { color: Colors.textSubtle }]}>Aucune recette disponible</Text>
              </View>
            }
          />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top, backgroundColor: playlist.coverColor }]}>
          <View style={[styles.heroControls, { top: insets.top + Spacing.md }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable style={styles.iconBtn} onPress={() => router.push(`/edit-playlist/${playlist.id}`)} hitSlop={8}>
                <MaterialIcons name="edit" size={20} color="#fff" />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={handleDeletePlaylist} hitSlop={8}>
                <MaterialIcons name="delete-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
          <MaterialIcons name="playlist-play" size={52} color="rgba(255,255,255,0.85)" />
          <Text style={styles.heroTitle}>{playlist.name}</Text>
          {playlist.description ? <Text style={styles.heroDesc}>{playlist.description}</Text> : null}
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}><MaterialIcons name="menu-book" size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.heroMetaText}>{playlistRecipes.length} recette{playlistRecipes.length > 1 ? 's' : ''}</Text></View>
            {totalDuration > 0 ? <View style={styles.heroMetaItem}><MaterialIcons name="schedule" size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.heroMetaText}>{formatDuration(totalDuration)}</Text></View> : null}
          </View>
        </View>

        <ScreenContainer style={{ padding: Spacing.md }}>
          {/* Add button */}
          <Pressable
            style={[styles.addRecipesBtn, { backgroundColor: playlist.coverColor + '15', borderColor: playlist.coverColor + '40' }]}
            onPress={() => setShowAddPanel(true)}
          >
            <MaterialIcons name="playlist-add" size={20} color={playlist.coverColor} />
            <Text style={[styles.addRecipesBtnText, { color: playlist.coverColor }]}>Ajouter des recettes</Text>
          </Pressable>

          {playlistRecipes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <MaterialIcons name="add-circle-outline" size={36} color={Colors.textMuted} />
              <Text style={[styles.emptyText, { color: Colors.textSubtle }]}>{'Aucune recette.\nAppuyez sur "Ajouter des recettes".'}</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recettes ({playlistRecipes.length})</Text>
              {playlistRecipes.map((recipe, idx) => (
                <View key={recipe.id} style={[styles.recipeCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
                  {/* Reorder buttons */}
                  <View style={styles.reorderBtns}>
                    <Pressable onPress={() => handleMoveUp(idx)} hitSlop={6} style={[styles.reorderBtn, { opacity: idx === 0 ? 0.25 : 1 }]}>
                      <MaterialIcons name="keyboard-arrow-up" size={20} color={Colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => handleMoveDown(idx)} hitSlop={6} style={[styles.reorderBtn, { opacity: idx === playlistRecipes.length - 1 ? 0.25 : 1 }]}>
                      <MaterialIcons name="keyboard-arrow-down" size={20} color={Colors.textMuted} />
                    </Pressable>
                  </View>

                  {/* Position badge */}
                  <View style={[styles.positionBadge, { backgroundColor: playlist.coverColor }]}>
                    <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xs }}>{idx + 1}</Text>
                  </View>

                  {/* Recipe thumb */}
                  <Pressable style={{ flex: 1, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                    <View style={[styles.recipeThumb, { backgroundColor: Colors.surfaceMuted, overflow: 'hidden' }]}>
                      {recipe.image
                        ? <Image source={{ uri: recipe.image }} style={{ width: 72, height: 72 }} contentFit="cover" />
                        : <Text style={{ fontSize: 30 }}>🍽️</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipeTitle, { color: Colors.text }]} numberOfLines={2}>{recipe.title}</Text>
                      <Text style={[styles.recipeDesc, { color: Colors.textSubtle }]} numberOfLines={1}>{recipe.description}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                        <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min</Text>
                        <Text style={{ color: Colors.textMuted }}>·</Text>
                        <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.servings} pers.</Text>
                        <View style={[styles.diffChip, {
                          backgroundColor: recipe.difficulty === 'Facile' ? '#E8F5E920' : recipe.difficulty === 'Moyen' ? '#FFF3E020' : '#FFEBEE20',
                        }]}>
                          <Text style={[{ fontSize: 9, fontWeight: FontWeight.bold, color: recipe.difficulty === 'Facile' ? Colors.secondary : recipe.difficulty === 'Moyen' ? Colors.accent : Colors.error }]}>{recipe.difficulty}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  <Pressable onPress={() => handleRemoveRecipe(recipe)} hitSlop={8} style={{ padding: 4 }}>
                    <MaterialIcons name="remove-circle-outline" size={20} color={Colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScreenContainer>
      </ScrollView>

      {playlistRecipes.length > 0 ? (
        <View style={[styles.ctaBar, { backgroundColor: Colors.surface, borderTopColor: Colors.border, paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable style={[styles.ctaBtn, { backgroundColor: playlist.coverColor }]} onPress={handleAddAllToList}>
            <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            <Text style={styles.ctaBtnText}>Ajouter tous les ingrédients à une liste</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 210, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md, gap: 6, position: 'relative' },
  heroControls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md },
  iconBtn: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroDesc: { color: 'rgba(255,255,255,0.82)', fontSize: FontSize.sm, textAlign: 'center' },
  heroMeta: { flexDirection: 'row', gap: Spacing.lg, marginTop: 4 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { color: 'rgba(255,255,255,0.82)', fontSize: FontSize.xs },

  addRecipesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: 12, marginBottom: Spacing.md, borderWidth: 1.5, borderStyle: 'dashed' },
  addRecipesBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  emptyCard: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },

  recipeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.xl, padding: Spacing.sm, marginBottom: Spacing.md, gap: Spacing.sm },
  reorderBtns: { flexDirection: 'column', gap: 0 },
  reorderBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  positionBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  recipeThumb: { width: 72, height: 72, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  recipeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, lineHeight: 20 },
  recipeDesc: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 2 },
  diffChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.round },

  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, padding: Spacing.md },
  ctaBtn: { borderRadius: Radius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Add panel
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  miniTabBar: { flexDirection: 'row', marginHorizontal: Spacing.md, marginVertical: Spacing.sm, borderRadius: Radius.md, padding: 4 },
  miniTabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radius.sm },
  miniTabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  addSearchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  addSearchInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.md },
  addRecipeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.sm, gap: Spacing.sm },
  addRecipeThumb: { width: 54, height: 54, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  addRecipeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  addRecipeAuthor: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  addRecipeMeta: { fontSize: FontSize.xs, marginTop: 2 },
  addBtnSmall: { width: 36, height: 36, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
});
