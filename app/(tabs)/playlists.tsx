//////////////////////////////////////////////////////////////////////////
//                              Playlists.tsx                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Liste des playlists de recettes de l'utilisateur, organisées en groupes imbriqués (une playlist peut appartenir à plusieurs groupes) avec navigation par fil d'Ariane.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import {
  RecipePlaylist,
  PlaylistGroup,
  generateId,
  getPlaylistGroups,
  addPlaylistGroup,
  updatePlaylistGroup,
  deletePlaylistGroup,
  updatePlaylist as updatePlaylistService,
  uploadPlaylistGroupImage,
} from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useResponsive } from '@/hooks/useResponsive';

const PLAYLIST_ICONS = ['playlist-play', 'restaurant', 'local-dining', 'outdoor-grill', 'cake', 'ramen-dining', 'lunch-dining', 'dinner-dining'] as const;

function getPlaylistIcon(index: number) {
  return PLAYLIST_ICONS[index % PLAYLIST_ICONS.length];
}

const GROUP_COLORS = ['#C0705A', '#6B8F71', '#5E7A8A', '#D4824A', '#7E5A8A', '#3A8A72', '#B0405A', '#4A5EA0'];

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { playlists, recipes, deletePlaylist, refreshAll } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { columns } = useResponsive();

  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  const [groupModal, setGroupModal] = useState<{ mode: 'create' | 'edit'; target?: PlaylistGroup } | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupColorInput, setGroupColorInput] = useState(GROUP_COLORS[0]);
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  const pickGroupImage = async () => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setGroupImageUri(result.assets[0].uri);
  };

  const takeGroupPhoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showAlert('Permission refusée', "L'accès à la caméra est requis."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setGroupImageUri(result.assets[0].uri);
  };

  const showGroupImageOptions = () => {
    showAlert('Photo du groupe', 'Choisissez une source', [
      { text: 'Galerie', onPress: () => void pickGroupImage() },
      { text: 'Appareil photo', onPress: () => void takeGroupPhoto() },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const [assignTarget, setAssignTarget] = useState<RecipePlaylist | null>(null);

  const loadGroups = async () => {
    const g = await getPlaylistGroups(user?.id);
    setGroups(g);
  };

  useEffect(() => {
    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  // Fil d'Ariane : remonte parentId depuis currentGroupId jusqu'à la racine.
  const breadcrumb = useMemo(() => {
    const path: PlaylistGroup[] = [];
    let cursor = groups.find(g => g.id === currentGroupId) ?? null;
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId ? groups.find(g => g.id === cursor!.parentId) ?? null : null;
    }
    return path;
  }, [groups, currentGroupId]);

  const childGroups = useMemo(
    () => groups.filter(g => g.parentId === currentGroupId),
    [groups, currentGroupId]
  );

  const visiblePlaylists = useMemo(
    () => playlists.filter(p =>
      currentGroupId === null ? p.groupIds.length === 0 : p.groupIds.includes(currentGroupId)
    ),
    [playlists, currentGroupId]
  );

  const countDescendantPlaylists = (groupId: string): number =>
    playlists.filter(p => p.groupIds.includes(groupId)).length;

  const countChildGroups = (groupId: string): number => groups.filter(g => g.parentId === groupId).length;

  // ── Création / ajout ──

  const handleAddPress = () => {
    showAlert('Ajouter', currentGroupId ? `Dans "${breadcrumb[breadcrumb.length - 1]?.name}"` : '', [
      { text: 'Nouveau catalogue', onPress: () => router.push('/create-playlist') },
      {
        text: 'Nouveau groupe', onPress: () => {
          setGroupNameInput('');
          setGroupColorInput(GROUP_COLORS[groups.length % GROUP_COLORS.length]);
          setGroupImageUri(null);
          setGroupModal({ mode: 'create' });
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleSaveGroup = async () => {
    const name = groupNameInput.trim();
    if (!name || !groupModal) return;
    setSavingGroup(true);
    try {
      let imageUrl = groupModal.target?.imageUrl;
      const groupId = groupModal.target?.id ?? generateId();
      if (groupImageUri && user?.id) {
        const uploaded = await uploadPlaylistGroupImage(groupImageUri, user.id, groupId);
        if (uploaded) imageUrl = uploaded;
      } else if (groupImageUri) {
        imageUrl = groupImageUri;
      }

      if (groupModal.mode === 'create') {
        const g: PlaylistGroup = {
          id: groupId,
          name,
          parentId: currentGroupId,
          color: groupColorInput,
          createdAt: new Date().toISOString(),
          imageUrl,
        };
        await addPlaylistGroup(g, user?.id);
      } else if (groupModal.target) {
        await updatePlaylistGroup({ ...groupModal.target, name, color: groupColorInput, imageUrl }, user?.id);
      }
      await loadGroups();
      setGroupModal(null);
      setGroupImageUri(null);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = (group: PlaylistGroup) => {
    const subCount = countChildGroups(group.id);
    const plCount = countDescendantPlaylists(group.id);
    const warning = subCount > 0 || plCount > 0
      ? ` Ses sous-groupes éventuels seront aussi supprimés, et il sera retiré des catalogues qui y étaient rattachés (ils ne sont pas supprimés).`
      : '';
    showAlert(`Supprimer "${group.name}" ?`, `Ce groupe sera définitivement supprimé.${warning}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => { void (async () => {
          await deletePlaylistGroup(group.id, groups, playlists, user?.id);
          await loadGroups();
          await refreshAll();
        })(); },
      },
    ]);
  };

  const handleGroupLongPress = (group: PlaylistGroup) => {
    showAlert(group.name, '', [
      {
        text: 'Modifier', onPress: () => {
          setGroupNameInput(group.name);
          setGroupColorInput(group.color);
          setGroupImageUri(null);
          setGroupModal({ mode: 'edit', target: group });
        },
      },
      { text: 'Supprimer', style: 'destructive', onPress: () => handleDeleteGroup(group) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleDelete = (playlist: RecipePlaylist) => {
    showAlert('Supprimer le catalogue ?', `"${playlist.name}" sera supprimé définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deletePlaylist(playlist.id) },
    ]);
  };

  const toggleAssign = async (playlist: RecipePlaylist, groupId: string) => {
    const has = playlist.groupIds.includes(groupId);
    const updated = { ...playlist, groupIds: has ? playlist.groupIds.filter(id => id !== groupId) : [...playlist.groupIds, groupId] };
    setAssignTarget(updated);
    await updatePlaylistService(updated, user?.id);
    await refreshAll();
  };

  const getRecipeCount = (playlist: RecipePlaylist) => playlist.recipeIds.length;

  const getTotalDuration = (playlist: RecipePlaylist) => {
    const total = playlist.recipeIds.reduce((acc, rid) => {
      const r = recipes.find(rec => rec.id === rid);
      return acc + (r?.duration ?? 0);
    }, 0);
    if (total === 0) return null;
    return total >= 60 ? `${Math.floor(total / 60)}h${total % 60 > 0 ? `${total % 60}min` : ''}` : `${total} min`;
  };

  const getPreviewRecipes = (playlist: RecipePlaylist) =>
    playlist.recipeIds.slice(0, 3).map(id => recipes.find(r => r.id === id)).filter(Boolean);

  const renderPlaylist = ({ item, index }: { item: RecipePlaylist; index: number }) => {
    const count = getRecipeCount(item);
    const duration = getTotalDuration(item);
    const previews = getPreviewRecipes(item);

    return (
      <Pressable
        style={[styles.card, columns > 1 && { flex: 1 }, { backgroundColor: Colors.surface, ...Shadow.sm }]}
        onPress={() => router.push(`/playlist/${item.id}`)}
      >
        {/* Color bar + icon */}
        <View style={[styles.cardAccent, { backgroundColor: item.coverColor }]}>
          <MaterialIcons name={getPlaylistIcon(index)} size={36} color="rgba(255,255,255,0.9)" />
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: Colors.text }]} numberOfLines={1}>{item.name}</Text>
          {item.description ? (
            <Text style={[styles.cardDesc, { color: Colors.textSubtle }]} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Preview recipe chips */}
          {previews.length > 0 ? (
            <View style={styles.previewRow}>
              {previews.map((r, i) => r ? (
                <View key={r.id} style={[styles.previewChip, { backgroundColor: item.coverColor + '18', borderColor: item.coverColor + '30' }]}>
                  <Text style={[styles.previewChipText, { color: item.coverColor }]} numberOfLines={1}>{r.title}</Text>
                </View>
              ) : null)}
              {count > 3 ? (
                <View style={[styles.previewChip, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
                  <Text style={[styles.previewChipText, { color: Colors.textMuted }]}>+{count - 3}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.emptyHint, { color: Colors.textMuted }]}>Aucune recette ajoutée</Text>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.metaItem}>
              <MaterialIcons name="menu-book" size={13} color={Colors.textMuted} />
              <Text style={[styles.metaText, { color: Colors.textMuted }]}>{count} recette{count > 1 ? 's' : ''}</Text>
            </View>
            {duration ? (
              <View style={styles.metaItem}>
                <MaterialIcons name="schedule" size={13} color={Colors.textMuted} />
                <Text style={[styles.metaText, { color: Colors.textMuted }]}>{duration} au total</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setAssignTarget(item)} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <MaterialIcons name="bookmark-border" size={18} color={Colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  const headerTitle = currentGroupId === null ? 'Catalogue de recettes' : breadcrumb[breadcrumb.length - 1]?.name ?? 'Catalogue de recettes';
  const headerSub = `${visiblePlaylists.length} catalogue${visiblePlaylists.length > 1 ? 's' : ''}${childGroups.length > 0 ? ` · ${childGroups.length} groupe${childGroups.length > 1 ? 's' : ''}` : ''}`;

  const ListHeader = (
    <View>
      {breadcrumb.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumb} contentContainerStyle={{ alignItems: 'center' }}>
          <Pressable onPress={() => setCurrentGroupId(null)}>
            <Text style={[styles.breadcrumbItem, { color: Colors.textSubtle }]}>Catalogue</Text>
          </Pressable>
          {breadcrumb.map(g => (
            <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
              <Pressable onPress={() => setCurrentGroupId(g.id)}>
                <Text
                  style={[
                    styles.breadcrumbItem,
                    { color: g.id === currentGroupId ? Colors.text : Colors.textSubtle },
                    g.id === currentGroupId && { fontWeight: FontWeight.bold },
                  ]}
                >
                  {g.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {childGroups.length > 0 ? (
        <View style={styles.groupGrid}>
          {childGroups.map(g => (
            <Pressable
              key={g.id}
              style={[styles.groupCard, { backgroundColor: g.color + '15', borderColor: g.color + '40', overflow: 'hidden' }]}
              onPress={() => setCurrentGroupId(g.id)}
              onLongPress={() => handleGroupLongPress(g)}
            >
              {g.imageUrl ? (
                <>
                  <Image source={{ uri: g.imageUrl }} style={StyleSheet.absoluteFillObject as any} contentFit="cover" />
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                </>
              ) : (
                <MaterialIcons name="folder" size={22} color={g.color} />
              )}
              <Text style={[styles.groupCardName, { color: g.imageUrl ? '#fff' : Colors.text }]} numberOfLines={1}>{g.name}</Text>
              <Text style={[styles.groupCardMeta, { color: g.imageUrl ? 'rgba(255,255,255,0.85)' : Colors.textMuted }]}>
                {countChildGroups(g.id) > 0 ? `${countChildGroups(g.id)} sous-groupe${countChildGroups(g.id) > 1 ? 's' : ''} · ` : ''}
                {countDescendantPlaylists(g.id)} catalogue{countDescendantPlaylists(g.id) > 1 ? 's' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>{headerTitle}</Text>
            <Text style={[styles.headerSub, { color: Colors.textSubtle }]}>{headerSub}</Text>
          </View>
          <Pressable style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={handleAddPress}>
            <MaterialIcons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </ScreenContainer>

      <ScreenContainer style={{ flex: 1, width: '100%' }}>
        <FlatList
          key={columns}
          data={visiblePlaylists}
          renderItem={renderPlaylist}
          keyExtractor={item => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: Spacing.md } : undefined}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            childGroups.length > 0 ? null : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialIcons name="playlist-play" size={56} color={Colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucun catalogue</Text>
                <Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>
                  {'Créez des collections de recettes\npour vos repas de la semaine, dîners\nou occasions spéciales.'}
                </Text>
                <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={handleAddPress}>
                  <MaterialIcons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Ajouter</Text>
                </Pressable>
              </View>
            )
          }
        />
      </ScreenContainer>

      {/* ── CREATE / EDIT GROUP MODAL ── */}
      <Modal visible={!!groupModal} transparent animationType="fade" onRequestClose={() => setGroupModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setGroupModal(null)}>
            <Pressable style={[styles.groupModal, { backgroundColor: Colors.surface }]} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.groupModalTitle, { color: Colors.text }]}>
                  {groupModal?.mode === 'create' ? 'Nouveau groupe' : 'Modifier le groupe'}
                </Text>

                {/* Photo */}
                <Pressable style={[styles.groupPhotoPicker, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]} onPress={showGroupImageOptions}>
                  {groupImageUri || groupModal?.target?.imageUrl ? (
                    <>
                      <Image source={{ uri: groupImageUri ?? groupModal?.target?.imageUrl }} style={StyleSheet.absoluteFillObject as any} contentFit="cover" />
                      <View style={styles.groupPhotoOverlay}>
                        <MaterialIcons name="edit" size={16} color="#fff" />
                        <Text style={styles.groupPhotoOverlayText}>Modifier la photo</Text>
                      </View>
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <MaterialIcons name="add-a-photo" size={24} color={Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Ajouter une photo (optionnel)</Text>
                    </View>
                  )}
                </Pressable>

                <TextInput
                  style={[styles.groupModalInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]}
                  placeholder="Nom du groupe..."
                  placeholderTextColor={Colors.textMuted}
                  value={groupNameInput}
                  onChangeText={setGroupNameInput}
                  autoFocus={groupModal?.mode === 'create'}
                  maxLength={40}
                />

                {/* Color */}
                <Text style={[styles.groupColorLabel, { color: Colors.textSubtle }]}>Couleur</Text>
                <View style={styles.groupColorGrid}>
                  {GROUP_COLORS.map(c => (
                    <Pressable
                      key={c}
                      style={[styles.groupColorSwatch, { backgroundColor: c }, groupColorInput === c && styles.groupColorSwatchActive]}
                      onPress={() => setGroupColorInput(c)}
                    >
                      {groupColorInput === c ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                    </Pressable>
                  ))}
                </View>

                <View style={styles.groupModalBtns}>
                  <Pressable style={[styles.groupModalBtn, { borderColor: Colors.border }]} onPress={() => setGroupModal(null)}>
                    <Text style={[styles.groupModalBtnText, { color: Colors.textSubtle }]}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupModalBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => void handleSaveGroup()}
                    disabled={savingGroup || !groupNameInput.trim()}
                  >
                    <Text style={[styles.groupModalBtnText, { color: '#fff' }]}>Enregistrer</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ASSIGN TO GROUPS MODAL ── */}
      <Modal visible={!!assignTarget} transparent animationType="fade" onRequestClose={() => setAssignTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAssignTarget(null)}>
          <Pressable style={[styles.groupModal, { backgroundColor: Colors.surface, maxHeight: '70%' }]} onPress={() => {}}>
            <Text style={[styles.groupModalTitle, { color: Colors.text }]}>{`Groupes de "${assignTarget?.name}"`}</Text>
            {groups.length === 0 ? (
              <Text style={{ fontSize: FontSize.sm, color: Colors.textSubtle, marginTop: Spacing.sm }}>
                {'Aucun groupe pour l\'instant — créez-en un depuis le bouton "+" de l\'écran Catalogue.'}
              </Text>
            ) : (
              <ScrollView style={{ marginTop: Spacing.sm }}>
                {groups.map(g => {
                  let depth = 0;
                  let cursor: PlaylistGroup | undefined = g;
                  while (cursor?.parentId) { depth++; cursor = groups.find(x => x.id === cursor!.parentId); }
                  const checked = !!assignTarget && assignTarget.groupIds.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      style={[styles.assignRow, { paddingLeft: Spacing.sm + depth * Spacing.lg }]}
                      onPress={() => assignTarget && void toggleAssign(assignTarget, g.id)}
                    >
                      <MaterialIcons
                        name={checked ? 'check-box' : 'check-box-outline-blank'}
                        size={20}
                        color={checked ? Colors.primary : Colors.textMuted}
                      />
                      <MaterialIcons name="folder" size={16} color={g.color} />
                      <Text style={[styles.assignRowText, { color: Colors.text }]} numberOfLines={1}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable style={[styles.groupModalBtn, { borderColor: Colors.border, marginTop: Spacing.md }]} onPress={() => setAssignTarget(null)}>
              <Text style={[styles.groupModalBtnText, { color: Colors.textSubtle }]}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.xs, marginTop: 2 },
  addBtn: { width: 42, height: 42, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },

  breadcrumb: { marginBottom: Spacing.sm },
  breadcrumbItem: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, paddingHorizontal: 2 },

  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  groupCard: {
    width: 150,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.sm,
    gap: 4,
  },
  groupCardName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  groupCardMeta: { fontSize: 10 },

  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  cardAccent: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: Radius.round,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  cardBody: { padding: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 2 },
  cardDesc: { fontSize: FontSize.sm, marginBottom: Spacing.sm },

  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.round,
    borderWidth: 1,
    maxWidth: 130,
  },
  previewChipText: { fontSize: 11, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.xs, fontStyle: 'italic', marginBottom: Spacing.sm },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyDesc: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 13,
    borderRadius: Radius.md,
  },
  emptyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  groupModal: { width: '100%', maxHeight: '85%', borderRadius: Radius.xl, padding: Spacing.lg },
  groupModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  groupModalInput: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.sm },
  groupModalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  groupModalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center' },
  groupModalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  groupPhotoPicker: { height: 100, borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  groupPhotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  groupPhotoOverlayText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.xs },
  groupColorLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6 },
  groupColorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  groupColorSwatch: { width: 36, height: 36, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  groupColorSwatchActive: { borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  assignRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingRight: Spacing.sm },
  assignRowText: { fontSize: FontSize.sm, flex: 1 },
});
