// Powered by OnSpace.AI
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { Recipe } from '@/services/kitchenService';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { playlists, recipes, shoppingLists, deletePlaylist, removeRecipeFromPlaylist, addRecipeToList } = useKitchen();
  const { showAlert } = useAlert();

  const playlist = useMemo(() => playlists.find(p => p.id === id), [playlists, id]);
  const playlistRecipes = useMemo(
    () => (playlist?.recipeIds ?? []).map(rid => recipes.find(r => r.id === rid)).filter(Boolean) as Recipe[],
    [playlist, recipes]
  );

  const totalDuration = useMemo(
    () => playlistRecipes.reduce((acc, r) => acc + r.duration, 0),
    [playlistRecipes]
  );

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
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
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deletePlaylist(playlist.id); router.back(); } },
    ]);
  };

  const handleRemoveRecipe = (recipe: Recipe) => {
    showAlert('Retirer de la playlist ?', `"${recipe.title}" sera retiré.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeRecipeFromPlaylist(playlist.id, recipe.id) },
    ]);
  };

  const handleAddAllToList = () => {
    if (shoppingLists.length === 0) {
      showAlert('Aucune liste', "Créez d'abord une liste de courses.");
      return;
    }
    if (playlistRecipes.length === 0) {
      showAlert('Playlist vide', 'Ajoutez des recettes à cette playlist d\'abord.');
      return;
    }
    showAlert('Ajouter tous les ingrédients', 'Choisissez une liste :', [
      ...shoppingLists.map(list => ({
        text: list.name,
        onPress: async () => {
          for (const recipe of playlistRecipes) {
            await addRecipeToList(list.id, recipe);
          }
          showAlert('Ajouté !', `Tous les ingrédients ont été ajoutés à "${list.name}".`);
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top, backgroundColor: playlist.coverColor }]}>
          <View style={[styles.heroControls, { top: insets.top + Spacing.md }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={handleDeletePlaylist} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={22} color="#fff" />
            </Pressable>
          </View>
          <MaterialIcons name="playlist-play" size={52} color="rgba(255,255,255,0.85)" />
          <Text style={styles.heroTitle}>{playlist.name}</Text>
          {playlist.description ? (
            <Text style={styles.heroDesc}>{playlist.description}</Text>
          ) : null}
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <MaterialIcons name="menu-book" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroMetaText}>{playlistRecipes.length} recette{playlistRecipes.length > 1 ? 's' : ''}</Text>
            </View>
            {totalDuration > 0 ? (
              <View style={styles.heroMetaItem}>
                <MaterialIcons name="schedule" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroMetaText}>{formatDuration(totalDuration)} au total</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ padding: Spacing.md }}>
          {/* Recipes */}
          {playlistRecipes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <MaterialIcons name="add-circle-outline" size={36} color={Colors.textMuted} />
              <Text style={[styles.emptyText, { color: Colors.textSubtle }]}>
                {'Aucune recette dans cette playlist.\nModifiez-la pour en ajouter.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recettes</Text>
              {playlistRecipes.map((recipe, idx) => (
                <Pressable
                  key={recipe.id}
                  style={[styles.recipeCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
                  <View style={[styles.recipeNum, { backgroundColor: playlist.coverColor }]}>
                    <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>{idx + 1}</Text>
                  </View>
                  <View style={[styles.recipeThumb, { backgroundColor: Colors.surfaceMuted, overflow: 'hidden' }]}>
                    {recipe.image ? (
                      <Image source={{ uri: recipe.image }} style={{ width: 52, height: 52 }} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 26 }}>🍽️</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recipeTitle, { color: Colors.text }]} numberOfLines={1}>{recipe.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min</Text>
                      <Text style={{ color: Colors.textMuted }}>·</Text>
                      <MaterialIcons name="people" size={12} color={Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.servings} pers.</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemoveRecipe(recipe)} hitSlop={8}>
                    <MaterialIcons name="remove-circle-outline" size={20} color={Colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* CTA bar */}
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
  hero: {
    minHeight: 200,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: 6,
    position: 'relative',
  },
  heroControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: Radius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  heroMeta: { flexDirection: 'row', gap: Spacing.lg, marginTop: 4 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { color: 'rgba(255,255,255,0.82)', fontSize: FontSize.xs },

  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  emptyCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },

  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  recipeNum: {
    width: 26,
    height: 26,
    borderRadius: Radius.round,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  recipeThumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: Spacing.md,
  },
  ctaBtn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
