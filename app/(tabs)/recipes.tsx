//////////////////////////////////////////////////////////////////////////
//                            🔍 Recipes.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran de recherche : recettes personnelles/publiques par mot-clé, et onglet « Personnes » pour trouver et suivre d'autres cuisiniers.
 */

// Powered by OnSpace.AI
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  FlatList, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { Recipe, PublicRecipe } from '@/services/kitchenService';
import { UserProfile, searchUsers, getAllUsers, followUser, unfollowUser } from '@/services/social/followService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useResponsive } from '@/hooks/useResponsive';
import { Layout } from '@/constants/layout';

type SearchTab = 'recettes' | 'personnes';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { recipes, publicRecipes, toggleFavorite, deleteRecipe, shoppingLists, addRecipeToList, playlists, updatePlaylist } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { width, columns } = useResponsive();
  const publicCardWidth = useMemo(() => {
    const containerWidth = Math.min(width, Layout.maxContentWidth) - Spacing.md * 2;
    return columns > 1 ? (containerWidth - Spacing.sm * (columns - 1)) / columns : containerWidth;
  }, [width, columns]);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('recettes');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [searching, setSearching] = useState(false);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const filteredMyRecipes = useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)));
  }, [recipes, search]);

  const filteredPublic = useMemo(() => {
    if (!search.trim()) return publicRecipes;
    const q = search.toLowerCase();
    return publicRecipes.filter(r => r.title.toLowerCase().includes(q) || (r.authorName || '').toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)));
  }, [publicRecipes, search]);

  const loadAllUsers = useCallback(async () => {
    if (!user) return;
    setLoadingAllUsers(true);
    const users = await getAllUsers(user.id);
    setAllUsers(users);
    setLoadingAllUsers(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'personnes') loadAllUsers();
  }, [activeTab, loadAllUsers]);

  const handleSearchUsers = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    const results = await searchUsers(q, user?.id);
    setUserResults(results);
    setSearching(false);
  }, [user?.id]);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (activeTab === 'personnes') handleSearchUsers(text);
  }, [activeTab, handleSearchUsers]);

  const handleFollowToggle = async (profile: UserProfile) => {
    if (!user) { showAlert('Connexion requise', 'Connectez-vous pour suivre des utilisateurs.'); return; }
    setFollowLoading(profile.id);
    const ok = profile.isFollowing ? await unfollowUser(profile.id) : await followUser(profile.id);
    if (ok) {
      const updateList = (list: UserProfile[]) =>
        list.map(u => u.id === profile.id ? { ...u, isFollowing: !u.isFollowing } : u);
      setUserResults(updateList);
      setAllUsers(updateList);
    }
    setFollowLoading(null);
  };

  const handleAddToPlaylist = (recipe: Recipe | PublicRecipe) => {
    if (playlists.length === 0) { showAlert('Aucune playlist', "Créez d'abord une playlist."); return; }
    showAlert('Ajouter à une playlist', 'Choisissez une playlist :', [
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

  const handleDelete = (recipe: Recipe) => {
    showAlert('Supprimer ?', `"${recipe.title}" sera supprimée définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
    ]);
  };

  const handleAddToList = (recipe: Recipe | PublicRecipe) => {
    if (shoppingLists.length === 0) { showAlert('Aucune liste', "Créez d'abord une liste de courses."); return; }
    showAlert('Ajouter à une liste', '', [
      ...shoppingLists.map(l => ({ text: l.name, onPress: async () => { await addRecipeToList(l.id, recipe); showAlert('Ajouté !', `Ingrédients ajoutés à "${l.name}".`); } })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const renderMyRecipe = (item: Recipe) => (
    <Pressable key={item.id} style={[styles.recipeCard, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/recipe/${item.id}`)}>
      <View style={[styles.cardImage, { backgroundColor: Colors.surfaceMuted }]}>
        {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={{ fontSize: 28 }}>🍽️</Text>}
        <Pressable style={styles.favBtn} onPress={() => toggleFavorite(item.id)} hitSlop={8}>
          <MaterialIcons name={item.isFavorite ? 'favorite' : 'favorite-border'} size={16} color={item.isFavorite ? '#FF6B6B' : '#fff'} />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: Colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.cardDesc, { color: Colors.textSubtle }]} numberOfLines={1}>{item.description}</Text>
        <View style={styles.metaRow}>
          <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
          <Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.duration} min</Text>
          <View style={[styles.diffBadge, { backgroundColor: item.difficulty === 'Facile' ? '#E8F5E9' : item.difficulty === 'Moyen' ? '#FFF3E0' : '#FFEBEE' }]}>
            <Text style={[styles.diffText, { color: item.difficulty === 'Facile' ? Colors.secondary : item.difficulty === 'Moyen' ? Colors.accent : Colors.error }]}>{item.difficulty}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={() => router.push(`/edit-recipe/${item.id}`)} hitSlop={8} style={styles.actionBtn}><MaterialIcons name="edit" size={15} color={Colors.primary} /></Pressable>
        <Pressable onPress={() => handleAddToPlaylist(item)} hitSlop={8} style={styles.actionBtn}><MaterialIcons name="playlist-add" size={15} color={Colors.accent} /></Pressable>
        <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.actionBtn}><MaterialIcons name="delete-outline" size={15} color={Colors.textMuted} /></Pressable>
      </View>
    </Pressable>
  );

  const renderPublicRecipe = (item: PublicRecipe) => (
    <View key={item.id} style={[styles.publicCard, { width: publicCardWidth, backgroundColor: Colors.surface, ...Shadow.sm }]}>
      <View style={[styles.publicImage, { backgroundColor: Colors.surfaceMuted }]}>
        {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={{ fontSize: 36 }}>🍽️</Text>}
      </View>
      <View style={styles.publicBody}>
        <Pressable style={styles.authorRow} onPress={() => item.authorId ? router.push(`/profile/${item.authorId}` as any) : null}>
          <View style={[styles.authorAvatar, { backgroundColor: Colors.primary + '15' }]}>
            <MaterialIcons name="person" size={13} color={Colors.primary} />
          </View>
          <Text style={[styles.authorName, { color: Colors.primary }]}>{item.authorName || 'Utilisateur'}</Text>
        </Pressable>
        <Text style={[styles.publicTitle, { color: Colors.text }]} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaRow}>
          <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
          <Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.duration} min</Text>
          <Text style={{ color: Colors.textMuted }}>·</Text>
          <Text style={[styles.metaText, { color: Colors.textMuted }]}>{item.servings} pers.</Text>
        </View>
        <View style={styles.publicBtns}>
          <Pressable style={[styles.publicBtn, { borderColor: Colors.secondary + '40', backgroundColor: Colors.secondary + '08' }]} onPress={() => handleAddToList(item)}>
            <MaterialIcons name="shopping-cart" size={14} color={Colors.secondary} />
            <Text style={[styles.publicBtnText, { color: Colors.secondary }]}>Liste</Text>
          </Pressable>
          <Pressable style={[styles.publicBtn, { borderColor: Colors.accent + '40', backgroundColor: Colors.accent + '08' }]} onPress={() => handleAddToPlaylist(item)}>
            <MaterialIcons name="playlist-add" size={14} color={Colors.accent} />
            <Text style={[styles.publicBtnText, { color: Colors.accent }]}>Playlist</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const displayedUsers = search.length >= 2 ? userResults : allUsers;

  const renderUser = ({ item }: { item: UserProfile }) => (
    <View style={[styles.userCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
      <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }} onPress={() => router.push(`/profile/${item.id}` as any)}>
        <View style={[styles.userAvatar, { backgroundColor: Colors.primary + '15' }]}>
          <Text style={{ fontSize: 22 }}>
            {(item.username || item.email)[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: Colors.text }]}>{item.username || item.email.split('@')[0]}</Text>
          <Text style={[styles.userSub, { color: Colors.textSubtle }]}>{item.publicRecipeCount} recette{item.publicRecipeCount !== 1 ? 's' : ''}</Text>
          {item.username ? <Text style={[styles.userSub, { color: Colors.textMuted, fontSize: 10 }]}>{item.email}</Text> : null}
        </View>
      </Pressable>
      <Pressable
        style={[styles.followBtn, { backgroundColor: item.isFollowing ? Colors.surfaceMuted : Colors.primary, borderColor: item.isFollowing ? Colors.border : Colors.primary }]}
        onPress={() => handleFollowToggle(item)}
        disabled={followLoading === item.id}
      >
        {followLoading === item.id
          ? <ActivityIndicator size="small" color={item.isFollowing ? Colors.textSubtle : '#fff'} />
          : (
            <>
              <MaterialIcons name={item.isFollowing ? 'person-remove' : 'person-add'} size={14} color={item.isFollowing ? Colors.textSubtle : '#fff'} />
              <Text style={[styles.followBtnText, { color: item.isFollowing ? Colors.textSubtle : '#fff' }]}>{item.isFollowing ? 'Suivi' : 'Suivre'}</Text>
            </>
          )}
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Rechercher</Text>
          <Pressable style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/create-recipe')}>
            <MaterialIcons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: Colors.surfaceMuted }]}>
          {([
            { key: 'recettes' as SearchTab, label: 'Recettes', icon: 'menu-book' },
            { key: 'personnes' as SearchTab, label: 'Personnes', icon: 'people' },
          ] as const).map(t => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && { backgroundColor: Colors.surface, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 }]}
              onPress={() => { setActiveTab(t.key); if (t.key === 'personnes' && search) handleSearchUsers(search); }}
            >
              <MaterialIcons name={t.icon as any} size={16} color={activeTab === t.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? Colors.primary : Colors.textMuted }]}>{t.label}</Text>
              {t.key === 'recettes' && recipes.length > 0 ? (
                <View style={[styles.countPill, { backgroundColor: activeTab === t.key ? Colors.primary + '20' : Colors.border }]}>
                  <Text style={[styles.countPillText, { color: activeTab === t.key ? Colors.primary : Colors.textMuted }]}>{recipes.length}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <MaterialIcons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: Colors.text }]}
            placeholder={activeTab === 'recettes' ? 'Titre, tag, ingrédient...' : 'Rechercher par pseudo ou email...'}
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={handleSearchChange}
            autoCorrect={false}
          />
          {search ? <Pressable onPress={() => { setSearch(''); setUserResults([]); }} hitSlop={8}><MaterialIcons name="clear" size={18} color={Colors.textMuted} /></Pressable> : null}
        </View>
      </ScreenContainer>

      {/* Recipes content */}
      {activeTab === 'recettes' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <ScreenContainer style={{ padding: Spacing.md }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Mes recettes</Text>
              <Text style={[styles.sectionCount, { color: Colors.textMuted, backgroundColor: Colors.surfaceMuted }]}>{filteredMyRecipes.length}</Text>
            </View>
            {filteredMyRecipes.length > 0
              ? filteredMyRecipes.map(r => renderMyRecipe(r))
              : <Text style={[styles.emptyHint, { color: Colors.textMuted }]}>{search ? 'Aucun résultat' : 'Aucune recette — créez-en une !'}</Text>}
            {filteredPublic.length > 0 ? (
              <>
                <View style={[styles.sectionRow, { marginTop: Spacing.lg }]}>
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>Communauté</Text>
                  <Text style={[styles.sectionCount, { color: Colors.textMuted, backgroundColor: Colors.surfaceMuted }]}>{filteredPublic.length}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {filteredPublic.map(r => renderPublicRecipe(r))}
                </View>
              </>
            ) : null}
            {recipes.length === 0 && publicRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 52 }}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>Rien à explorer encore</Text>
                <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/create-recipe')}>
                  <Text style={styles.emptyBtnText}>Créer ma première recette</Text>
                </Pressable>
              </View>
            ) : null}
          </ScreenContainer>
        </ScrollView>
      ) : (
        /* People content */
        <View style={{ flex: 1 }}>
          {!user ? (
            <View style={styles.centerState}>
              <MaterialIcons name="person-search" size={56} color={Colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Connectez-vous</Text>
              <Text style={[styles.emptyHint, { color: Colors.textSubtle }]}>pour rechercher et suivre des cuisiniers</Text>
              <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/login')}>
                <Text style={styles.emptyBtnText}>Se connecter</Text>
              </Pressable>
            </View>
          ) : loadingAllUsers && search.length < 2 ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={[styles.emptyHint, { color: Colors.textSubtle }]}>Chargement des cuisiniers...</Text>
            </View>
          ) : search.length >= 2 && searching ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={[styles.emptyHint, { color: Colors.textSubtle }]}>Recherche en cours...</Text>
            </View>
          ) : search.length >= 2 && userResults.length === 0 ? (
            <View style={styles.centerState}>
              <MaterialIcons name="person-off" size={56} color={Colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucun utilisateur trouvé</Text>
              <Text style={[styles.emptyHint, { color: Colors.textSubtle }]}>Essayez avec un autre pseudo ou email</Text>
            </View>
          ) : displayedUsers.length > 0 ? (
            <ScreenContainer style={{ flex: 1 }}>
              <FlatList
                data={displayedUsers}
                renderItem={renderUser}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  search.length < 2 ? (
                    <Text style={[styles.allUsersHeader, { color: Colors.textSubtle }]}>
                      {allUsers.length} cuisinier{allUsers.length !== 1 ? 's' : ''} inscrit{allUsers.length !== 1 ? 's' : ''}
                    </Text>
                  ) : null
                }
              />
            </ScreenContainer>
          ) : (
            <View style={styles.centerState}>
              <MaterialIcons name="people-outline" size={56} color={Colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucun cuisinier pour le moment</Text>
            </View>
          )}
        </View>
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
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  countPill: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  countPillText: { fontSize: 10, fontWeight: FontWeight.bold },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: FontSize.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: FontWeight.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round },
  emptyHint: { fontSize: FontSize.sm, textAlign: 'center', marginVertical: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyBtn: { paddingHorizontal: Spacing.xl, paddingVertical: 11, borderRadius: Radius.md, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  allUsersHeader: { fontSize: FontSize.sm, marginBottom: Spacing.sm, fontStyle: 'italic' },

  recipeCard: { flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.sm, minHeight: 90 },
  cardImage: { width: 80, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  favBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 },
  cardBody: { flex: 1, padding: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 2 },
  cardDesc: { fontSize: FontSize.xs, lineHeight: 16, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11 },
  diffBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.round },
  diffText: { fontSize: 9, fontWeight: FontWeight.bold },
  cardActions: { flexDirection: 'column', padding: Spacing.xs, gap: 2, justifyContent: 'center', alignItems: 'center', paddingRight: Spacing.sm },
  actionBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },

  publicCard: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.sm },
  publicImage: { height: 130, justifyContent: 'center', alignItems: 'center' },
  publicBody: { padding: Spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  authorAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  publicTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 6 },
  publicBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  publicBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1 },
  publicBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  userAvatar: { width: 48, height: 48, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  userName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  userSub: { fontSize: FontSize.xs, marginTop: 2 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.round, borderWidth: 1, minWidth: 80, justifyContent: 'center' },
  followBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
