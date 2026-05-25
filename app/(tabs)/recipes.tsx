// Powered by OnSpace.AI
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { Recipe, PublicRecipe } from '@/services/kitchenService';

const MY_FILTERS = ['Toutes', 'Favoris', 'Facile', 'Moyen', 'Difficile', 'Végétarien', 'Dessert'];
type TabMode = 'mes-recettes' | 'communaute';

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { recipes, publicRecipes, toggleFavorite, togglePublic, deleteRecipe, refreshPublicRecipes, shoppingLists, addRecipeToList } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [tab, setTab] = useState<TabMode>('mes-recettes');
  const [refreshing, setRefreshing] = useState(false);

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const filtered = useMemo(() => {
    let list = recipes;
    if (search.trim()) list = list.filter(r => r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter === 'Favoris') list = list.filter(r => r.isFavorite);
    else if (['Facile', 'Moyen', 'Difficile'].includes(activeFilter)) list = list.filter(r => r.difficulty === activeFilter);
    else if (activeFilter !== 'Toutes') list = list.filter(r => r.tags.includes(activeFilter));
    return list;
  }, [recipes, search, activeFilter]);

  const filteredPublic = useMemo(() => {
    if (!search.trim()) return publicRecipes;
    return publicRecipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()) || (r.authorName || '').toLowerCase().includes(search.toLowerCase()));
  }, [publicRecipes, search]);

  const handleDelete = (recipe: Recipe) => {
    showAlert('Supprimer la recette', `Supprimer "${recipe.title}" définitivement ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
    ]);
  };

  const handleTogglePublic = (recipe: Recipe) => {
    if (!user) { showAlert('Connexion requise', 'Connectez-vous pour partager vos recettes.'); return; }
    const next = !recipe.isPublic;
    showAlert(next ? 'Partager cette recette ?' : 'Rendre privée ?',
      next ? 'Votre recette sera visible par tous.' : 'Votre recette ne sera plus visible.',
      [{ text: 'Annuler', style: 'cancel' }, { text: next ? 'Partager' : 'Rendre privée', onPress: () => togglePublic(recipe.id) }]);
  };

  const handleAddCommunityToList = (recipe: PublicRecipe) => {
    if (shoppingLists.length === 0) { showAlert('Aucune liste', "Créez d'abord une liste de courses."); return; }
    showAlert('Ajouter à une liste', 'Choisissez une liste :', [
      ...shoppingLists.map(list => ({ text: list.name, onPress: async () => { await addRecipeToList(list.id, recipe); showAlert('Ajouté !', `Ingrédients ajoutés à "${list.name}".`); } })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const handleRefreshCommunity = async () => { setRefreshing(true); await refreshPublicRecipes(); setRefreshing(false); };

  const renderMyRecipe = ({ item }: { item: Recipe }) => (
    <Pressable style={[styles.recipeCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/recipe/${item.id}`)}>
      <View style={[styles.cardImageArea, { backgroundColor: Colors.surfaceMuted }]}>
        {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={{ fontSize: 40 }}>🍽️</Text>}
        <Pressable style={styles.favoriteBtn} onPress={() => toggleFavorite(item.id)} hitSlop={8}>
          <MaterialIcons name={item.isFavorite ? 'favorite' : 'favorite-border'} size={20} color={item.isFavorite ? Colors.primary : Colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: Colors.text }]} numberOfLines={1}>{item.title}</Text>
          {item.isPublic ? (
            <View style={[styles.publicBadge, { backgroundColor: Colors.secondary + '15' }]}>
              <MaterialIcons name="public" size={11} color={Colors.secondary} />
              <Text style={[styles.publicBadgeText, { color: Colors.secondary }]}>Partagée</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.cardDesc, { color: Colors.textSubtle }]} numberOfLines={1}>{item.description}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}><MaterialIcons name="schedule" size={13} color={Colors.textMuted} /><Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.duration} min</Text></View>
          <View style={styles.metaItem}><MaterialIcons name="people" size={13} color={Colors.textMuted} /><Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.servings} pers.</Text></View>
          <View style={[styles.diffBadge, { backgroundColor: item.difficulty === 'Facile' ? '#E8F5E9' : item.difficulty === 'Moyen' ? '#FFF3E0' : '#FFEBEE' }]}>
            <Text style={[styles.diffText, { color: item.difficulty === 'Facile' ? Colors.secondary : item.difficulty === 'Moyen' ? Colors.accent : Colors.error }]}>{item.difficulty}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={() => handleTogglePublic(item)} hitSlop={8} style={styles.cardActionBtn}>
          <MaterialIcons name={item.isPublic ? 'public' : 'public-off'} size={18} color={item.isPublic ? Colors.secondary : Colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.cardActionBtn}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );

  const renderPublicRecipe = ({ item }: { item: PublicRecipe }) => (
    <View style={[styles.communityCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
      <View style={[styles.communityImageArea, { backgroundColor: Colors.surfaceMuted }]}>
        {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={{ fontSize: 36 }}>🍽️</Text>}
      </View>
      <View style={styles.communityBody}>
        <View style={styles.authorRow}>
          <View style={[styles.authorAvatar, { backgroundColor: Colors.primary + '15' }]}>
            <MaterialIcons name="person" size={14} color={Colors.primary} />
          </View>
          <Text style={[styles.authorName, { color: Colors.primary }]}>{item.authorName || 'Utilisateur'}</Text>
        </View>
        <Text style={[styles.communityTitle, { color: Colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.communityDesc, { color: Colors.textSubtle }]} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}><MaterialIcons name="schedule" size={12} color={Colors.textMuted} /><Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.duration} min</Text></View>
          <View style={styles.metaItem}><MaterialIcons name="people" size={12} color={Colors.textMuted} /><Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.servings} pers.</Text></View>
        </View>
        <View style={styles.communityTagsRow}>
          {item.tags.slice(0, 3).map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: Colors.surfaceMuted }]}>
              <Text style={[styles.tagText, { color: Colors.textSubtle }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <Pressable style={[styles.addToListBtn, { borderColor: Colors.secondary + '40', backgroundColor: Colors.secondary + '08' }]} onPress={() => handleAddCommunityToList(item)}>
          <MaterialIcons name="playlist-add" size={16} color={Colors.secondary} />
          <Text style={[styles.addToListText, { color: Colors.secondary }]}>Ajouter à ma liste</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: Colors.text }]}>Recettes</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/create-recipe')}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={[styles.tabBar, { backgroundColor: Colors.surfaceMuted }]}>
        {(['mes-recettes', 'communaute'] as TabMode[]).map(t => (
          <Pressable key={t} style={[styles.tabBtn, tab === t && { backgroundColor: Colors.surface, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 }]}
            onPress={() => { setTab(t); if (t === 'communaute') handleRefreshCommunity(); }}>
            <MaterialIcons name={t === 'mes-recettes' ? 'menu-book' : 'people'} size={16} color={tab === t ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabBtnText, { color: tab === t ? Colors.primary : Colors.textMuted }]}>{t === 'mes-recettes' ? 'Mes recettes' : 'Communauté'}</Text>
            {(t === 'mes-recettes' ? recipes : publicRecipes).length > 0 ? (
              <View style={[styles.countPill, { backgroundColor: tab === t ? Colors.primary + '20' : Colors.border }]}>
                <Text style={[styles.countPillText, { color: tab === t ? Colors.primary : Colors.textMuted }]}>{(t === 'mes-recettes' ? recipes : publicRecipes).length}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <View style={[styles.searchContainer, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} style={{ marginRight: Spacing.sm }} />
        <TextInput style={[styles.searchInput, { color: Colors.text }]} placeholder={tab === 'mes-recettes' ? 'Rechercher une recette...' : 'Rechercher dans la communauté...'} placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
        {search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><MaterialIcons name="clear" size={18} color={Colors.textMuted} /></Pressable> : null}
      </View>

      {tab === 'mes-recettes' ? (
        <>
          <View style={{ marginBottom: Spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: 4 }}>
              {MY_FILTERS.map(f => (
                <Pressable key={f} style={[styles.filterChip, { backgroundColor: activeFilter === f ? Colors.primary : Colors.surfaceMuted, borderColor: activeFilter === f ? Colors.primary : Colors.border }]} onPress={() => setActiveFilter(f)}>
                  <Text style={[styles.filterText, { color: activeFilter === f ? '#fff' : Colors.textSubtle }]}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {user && recipes.length > 0 ? (
            <View style={[styles.shareHint, { backgroundColor: Colors.secondary + '10' }]}>
              <MaterialIcons name="public" size={14} color={Colors.secondary} />
              <Text style={[styles.shareHintText, { color: Colors.secondary }]}>Appuyez sur l'icône partage pour rendre une recette publique</Text>
            </View>
          ) : null}
          <FlatList data={filtered} renderItem={renderMyRecipe} keyExtractor={item => item.id} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.emptyState}><Text style={{ fontSize: 48 }}>📖</Text><Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucune recette trouvée</Text><Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>{"Créez votre première recette !"}</Text><Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/create-recipe')}><Text style={styles.emptyBtnText}>Créer une recette</Text></Pressable></View>}
          />
        </>
      ) : (
        <FlatList data={filteredPublic} renderItem={renderPublicRecipe} keyExtractor={item => item.id} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false} onRefresh={handleRefreshCommunity} refreshing={refreshing}
          ListHeaderComponent={!user ? (
            <View style={[styles.loginPrompt, { backgroundColor: Colors.surface, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 }]}>
              <MaterialIcons name="lock-outline" size={22} color={Colors.textMuted} />
              <Text style={[styles.loginPromptText, { color: Colors.textSubtle }]}>Connectez-vous pour partager vos recettes.</Text>
              <Pressable style={[styles.loginPromptBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/login')}><Text style={styles.loginPromptBtnText}>Se connecter</Text></Pressable>
            </View>
          ) : null}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={{ fontSize: 48 }}>👥</Text><Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucune recette partagée</Text><Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>{user ? "Soyez le premier à partager une recette !" : "Connectez-vous pour voir les recettes."}</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  addBtn: { width: 40, height: 40, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.md, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.sm },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  countPill: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  countPillText: { fontSize: 10, fontWeight: FontWeight.bold },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FontSize.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  shareHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  shareHintText: { fontSize: FontSize.xs, flex: 1 },
  recipeCard: { borderRadius: Radius.lg, overflow: 'hidden', flexDirection: 'row' },
  cardImageArea: { width: 88, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  favoriteBtn: { position: 'absolute', top: 6, right: 6 },
  cardBody: { flex: 1, padding: Spacing.md, paddingRight: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, flex: 1 },
  publicBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.round },
  publicBadgeText: { fontSize: 9, fontWeight: FontWeight.bold },
  cardDesc: { fontSize: FontSize.xs, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.round },
  diffText: { fontSize: 10, fontWeight: FontWeight.bold },
  cardActions: { flexDirection: 'column', padding: Spacing.sm, gap: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  cardActionBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  communityCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  communityImageArea: { height: 160, justifyContent: 'center', alignItems: 'center' },
  communityBody: { padding: Spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  authorAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  communityTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, lineHeight: 24, marginBottom: 4 },
  communityDesc: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.sm },
  communityTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.round },
  tagText: { fontSize: 10 },
  addToListBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, alignSelf: 'flex-start' },
  addToListText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  loginPrompt: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.md },
  loginPromptText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  loginPromptBtn: { paddingHorizontal: Spacing.xl, paddingVertical: 10, borderRadius: Radius.md },
  loginPromptBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyDesc: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: Radius.md },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
