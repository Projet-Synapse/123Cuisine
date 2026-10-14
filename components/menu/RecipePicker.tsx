//////////////////////////////////////////////////////////////////////////
//                         🍽️ RecipePicker.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Panneau plein écran de choix d'une recette (mes recettes ou communauté),
 * utilisé par le menu de la semaine pour placer un plat sur un créneau.
 * Même fonctionnement que le panneau d'ajout de l'écran Catégorie — extrait
 * ici pour être réutilisable. Rend null quand il est fermé : le parent
 * l'affiche en remplacement de son contenu, comme dans categorie/[id].tsx.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { Recipe, PublicRecipe } from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';

interface RecipePickerProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  // Reçoit la recette choisie, personnelle (Recipe) ou de communauté
  // (PublicRecipe). Le parent décide quoi en faire.
  onSelect: (recipe: Recipe | PublicRecipe) => void;
}

export function RecipePicker({ visible, title, onClose, onSelect }: RecipePickerProps) {
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { recipes, publicRecipes } = useKitchen();

  const [tab, setTab] = useState<'mes' | 'communaute'>('mes');
  const [search, setSearch] = useState('');

  // Reprise à zéro à chaque ouverture : une recherche laissée en vrac lors
  // de l'utilisation précédente ne doit pas filtrer le choix suivant.
  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const q = search.toLowerCase();
  const myRecipes = useMemo(() => recipes.filter(r => !q || r.title.toLowerCase().includes(q)), [recipes, q]);
  const community = useMemo(
    () =>
      publicRecipes.filter(
        r => !q || r.title.toLowerCase().includes(q) || (r.authorName || '').toLowerCase().includes(q),
      ),
    [publicRecipes, q],
  );

  if (!visible) return null;

  const data = tab === 'mes' ? myRecipes : community;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <View style={[styles.panelHeader, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <Pressable onPress={onClose} hitSlop={8}>
          <MaterialIcons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={[styles.panelTitle, { color: Colors.text }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScreenContainer style={{ width: '100%' }}>
        <View style={[styles.miniTabBar, { backgroundColor: Colors.surfaceMuted }]}>
          {(['mes', 'communaute'] as const).map(key => (
            <Pressable
              key={key}
              style={[styles.miniTabBtn, tab === key && { backgroundColor: Colors.surface }]}
              onPress={() => setTab(key)}
            >
              <MaterialIcons
                name={key === 'mes' ? 'menu-book' : 'public'}
                size={15}
                color={tab === key ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.miniTabText, { color: tab === key ? Colors.primary : Colors.textMuted }]}>
                {key === 'mes' ? 'Mes recettes' : 'Communauté'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <MaterialIcons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: Colors.text }]}
            placeholder="Rechercher..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </ScreenContainer>

      <ScreenContainer style={{ flex: 1, width: '100%' }}>
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.recipeRow,
                {
                  backgroundColor: Colors.surface,
                  shadowColor: Colors.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 1,
                  shadowRadius: 2,
                  elevation: 1,
                },
              ]}
              onPress={() => onSelect(item)}
            >
              <View style={[styles.recipeThumb, { backgroundColor: Colors.surfaceMuted }]}>
                {(item as Recipe).image ? (
                  <Image source={{ uri: (item as Recipe).image! }} style={{ width: 54, height: 54 }} contentFit="cover" />
                ) : (
                  <Text style={{ fontSize: 24 }}>🍽️</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recipeTitle, { color: Colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {tab === 'communaute' ? (
                  <Text style={[styles.recipeAuthor, { color: Colors.primary }]}>
                    {(item as PublicRecipe).authorName}
                  </Text>
                ) : null}
                <Text style={[styles.recipeMeta, { color: Colors.textMuted }]}>
                  {item.duration} min · {item.difficulty}
                </Text>
              </View>
              <View style={[styles.addDot, { backgroundColor: Colors.primary + '15' }]}>
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

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    panelTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    miniTabBar: {
      flexDirection: 'row',
      marginHorizontal: Spacing.md,
      marginVertical: Spacing.sm,
      borderRadius: Radius.md,
      padding: 4,
    },
    miniTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: Radius.sm,
    },
    miniTabText: { fontSize: FontSize.sm, fontWeight: '600' },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.md },
    recipeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.lg,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    recipeThumb: {
      width: 54,
      height: 54,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    recipeTitle: { fontSize: FontSize.md, fontWeight: '600' },
    recipeAuthor: { fontSize: FontSize.xs, fontWeight: '500', marginTop: 1 },
    recipeMeta: { fontSize: FontSize.xs, marginTop: 2 },
    addDot: { width: 36, height: 36, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  });
};
