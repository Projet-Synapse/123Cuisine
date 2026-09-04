//////////////////////////////////////////////////////////////////////////
//                              Catégories.tsx                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Liste des catégories de recettes de l'utilisateur, organisées en dossiers imbriqués (une catégorie peut appartenir à plusieurs dossiers) avec navigation par fil d'Ariane.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight, ACCENT_SWATCHES } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import {
  Categorie,
  Dossier,
  generateId,
  getDossiers,
  addDossier,
  updateDossier,
  deleteDossier,
  uploadDossierImage,
} from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useResponsive } from '@/hooks/useResponsive';
import { IconAction } from '@/components/IconAction';

const PLAYLIST_ICONS = [
  'playlist-play',
  'restaurant',
  'local-dining',
  'outdoor-grill',
  'cake',
  'ramen-dining',
  'lunch-dining',
  'dinner-dining',
] as const;

function getPlaylistIcon(index: number) {
  return PLAYLIST_ICONS[index % PLAYLIST_ICONS.length];
}

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useAppTheme();
  const { Colors, FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { categories, recipes, deleteCategorie, updateCategorie, refreshAll } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { columns } = useResponsive();

  const [dossiers, setGroups] = useState<Dossier[]>([]);
  // Ouverture directe sur un dossier : `/categories?group=<id>` est ce que
  // poussent les tuiles « Dossier » du mur de créations de Mon espace.
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const [currentDossierId, setCurrentDossierId] = useState<string | null>(groupParam ?? null);

  useEffect(() => {
    if (groupParam) setCurrentDossierId(groupParam);
  }, [groupParam]);

  const [dossierModal, setGroupModal] = useState<{ mode: 'create' | 'edit'; target?: Dossier } | null>(null);
  const [dossierNameInput, setGroupNameInput] = useState('');
  const [dossierColorInput, setGroupColorInput] = useState(ACCENT_SWATCHES[0]);
  const [dossierImageUri, setDossierImageUri] = useState<string | null>(null);
  const [savingDossier, setSavingGroup] = useState(false);

  const pickDossierImage = async () => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setDossierImageUri(result.assets[0].uri);
  };

  const takeGroupPhoto = async () => {
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission refusée', "L'accès à la caméra est requis.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setDossierImageUri(result.assets[0].uri);
  };

  const showDossierImageOptions = () => {
    showAlert('Photo du fichier', 'Choisissez une source', [
      { text: 'Galerie', onPress: () => void pickDossierImage() },
      { text: 'Appareil photo', onPress: () => void takeGroupPhoto() },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const [assignTarget, setAssignTarget] = useState<Categorie | null>(null);

  const loadDossiers = async () => {
    const g = await getDossiers(user?.id);
    setGroups(g);
  };

  useEffect(() => {
    void loadDossiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Tirer-pour-rafraîchir, absent jusqu'ici sur cet écran contrairement à
  // Accueil et Recherche.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDossiers(), refreshAll()]);
    setRefreshing(false);
  };

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  // Fil d'Ariane : remonte parentId depuis currentDossierId jusqu'à la racine.
  const breadcrumb = useMemo(() => {
    const path: Dossier[] = [];
    let cursor = dossiers.find(g => g.id === currentDossierId) ?? null;
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId ? (dossiers.find(g => g.id === cursor!.parentId) ?? null) : null;
    }
    return path;
  }, [dossiers, currentDossierId]);

  const childDossiers = useMemo(() => dossiers.filter(g => g.parentId === currentDossierId), [dossiers, currentDossierId]);

  const visiblePlaylists = useMemo(
    () =>
      categories.filter(p => (currentDossierId === null ? p.dossierIds.length === 0 : p.dossierIds.includes(currentDossierId))),
    [categories, currentDossierId],
  );

  const countDescendantCategories = (groupId: string): number =>
    categories.filter(p => p.dossierIds.includes(groupId)).length;

  const countChildDossiers = (groupId: string): number => dossiers.filter(g => g.parentId === groupId).length;

  // ── Création / ajout ──

  const handleAddPress = () => {
    showAlert('Ajouter', currentDossierId ? `Dans "${breadcrumb[breadcrumb.length - 1]?.name}"` : '', [
      {
        text: 'Nouvelle catégorie',
        // Le dossier courant part dans l'URL : sans lui, la catégorie créée
        // depuis l'intérieur d'un dossier retombait à la racine.
        onPress: () =>
          router.push(
            currentDossierId ? `/create-categorie?dossier=${currentDossierId}` : '/create-categorie',
          ),
      },
      {
        text: 'Nouveau dossier',
        onPress: () => {
          setGroupNameInput('');
          setGroupColorInput(ACCENT_SWATCHES[dossiers.length % ACCENT_SWATCHES.length]);
          setDossierImageUri(null);
          setGroupModal({ mode: 'create' });
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleSaveDossier = async () => {
    const name = dossierNameInput.trim();
    if (!name || !dossierModal) return;
    setSavingGroup(true);
    try {
      let imageUrl = dossierModal.target?.imageUrl;
      const dossierId = dossierModal.target?.id ?? generateId();
      if (dossierImageUri && user?.id) {
        const { url, error } = await uploadDossierImage(dossierImageUri, user.id, dossierId);
        if (!url) {
          // On s'arrête au lieu d'enregistrer le dossier sans sa photo : c'est
          // ce silence qui donnait l'impression que l'ajout de photo « n'était
          // pas pris en compte ».
          showAlert('Photo non envoyée', error ?? "La photo n'a pas pu être envoyée.");
          return;
        }
        imageUrl = url;
      } else if (dossierImageUri) {
        // Mode invité : pas de compte, donc pas d'envoi — on garde l'adresse
        // locale, qui reste valable sur cet appareil.
        imageUrl = dossierImageUri;
      }

      if (dossierModal.mode === 'create') {
        const g: Dossier = {
          id: dossierId,
          name,
          parentId: currentDossierId,
          color: dossierColorInput,
          createdAt: new Date().toISOString(),
          imageUrl,
        };
        await addDossier(g, user?.id);
      } else if (dossierModal.target) {
        await updateDossier({ ...dossierModal.target, name, color: dossierColorInput, imageUrl }, user?.id);
      }
      await loadDossiers();
      setGroupModal(null);
      setDossierImageUri(null);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteDossier = (group: Dossier) => {
    const subCount = countChildDossiers(group.id);
    const plCount = countDescendantCategories(group.id);
    const warning =
      subCount > 0 || plCount > 0
        ? ` Ses sous-dossiers éventuels seront aussi supprimés, et il sera retiré des catégories qui y étaient rattachés (ils ne sont pas supprimés).`
        : '';
    showAlert(`Supprimer "${group.name}" ?`, `Ce dossier sera définitivement supprimé.${warning}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDossier(group.id, dossiers, categories, user?.id);
            await loadDossiers();
            await refreshAll();
          })();
        },
      },
    ]);
  };

  const handleDossierLongPress = (group: Dossier) => {
    showAlert(group.name, '', [
      {
        text: 'Modifier',
        onPress: () => {
          setGroupNameInput(group.name);
          setGroupColorInput(group.color);
          setDossierImageUri(null);
          setGroupModal({ mode: 'edit', target: group });
        },
      },
      { text: 'Supprimer', style: 'destructive', onPress: () => handleDeleteDossier(group) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleDelete = (categorie: Categorie) => {
    showAlert('Supprimer la catégorie ?', `"${categorie.name}" sera supprimée définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteCategorie(categorie.id) },
    ]);
  };

  // updateCategorie (contexte) met déjà à jour `categories` en local avant
  // d'écrire côté serveur : pas besoin d'un refreshAll() complet (recettes +
  // listes + préférences + catégories) à chaque coche, ce qui saccadait
  // l'assignation de plusieurs dossiers à la suite.
  const toggleAssign = async (categorie: Categorie, groupId: string) => {
    const has = categorie.dossierIds.includes(groupId);
    const updated = {
      ...categorie,
      dossierIds: has ? categorie.dossierIds.filter(id => id !== groupId) : [...categorie.dossierIds, groupId],
    };
    setAssignTarget(updated);
    await updateCategorie(updated);
  };

  const getRecipeCount = (categorie: Categorie) => categorie.recipeIds.length;

  const getTotalDuration = (categorie: Categorie) => {
    const total = categorie.recipeIds.reduce((acc, rid) => {
      const r = recipes.find(rec => rec.id === rid);
      return acc + (r?.duration ?? 0);
    }, 0);
    if (total === 0) return null;
    return total >= 60 ? `${Math.floor(total / 60)}h${total % 60 > 0 ? `${total % 60}min` : ''}` : `${total} min`;
  };

  const getPreviewRecipes = (categorie: Categorie) =>
    categorie.recipeIds
      .slice(0, 3)
      .map(id => recipes.find(r => r.id === id))
      .filter(Boolean);

  const renderPlaylist = ({ item, index }: { item: Categorie; index: number }) => {
    const count = getRecipeCount(item);
    const duration = getTotalDuration(item);
    const previews = getPreviewRecipes(item);

    return (
      <Pressable
        style={[styles.card, columns > 1 && { flex: 1 }, { backgroundColor: Colors.surface, ...Shadow.sm }]}
        onPress={() => router.push(`/categorie/${item.id}`)}
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
          <Text style={[styles.cardTitle, { color: Colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={[styles.cardDesc, { color: Colors.textSubtle }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}

          {/* Preview recipe chips */}
          {previews.length > 0 ? (
            <View style={styles.previewRow}>
              {previews.map((r, i) =>
                r ? (
                  <View
                    key={r.id}
                    style={[
                      styles.previewChip,
                      { backgroundColor: item.coverColor + '18', borderColor: item.coverColor + '30' },
                    ]}
                  >
                    <Text style={[styles.previewChipText, { color: item.coverColor }]} numberOfLines={1}>
                      {r.title}
                    </Text>
                  </View>
                ) : null,
              )}
              {count > 3 ? (
                <View
                  style={[styles.previewChip, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}
                >
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
              <Text style={[styles.metaText, { color: Colors.textMuted }]}>
                {count} recette{count > 1 ? 's' : ''}
              </Text>
            </View>
            {duration ? (
              <View style={styles.metaItem}>
                <MaterialIcons name="schedule" size={13} color={Colors.textMuted} />
                <Text style={[styles.metaText, { color: Colors.textMuted }]}>{duration} au total</Text>
              </View>
            ) : null}
            {/* Ces deux boutons étaient de simples icônes sans libellé — dont
                un signet, qui ne dit à personne qu'il sert à ranger dans un
                dossier. IconAction leur donne une bulle d'aide au survol. */}
            <IconAction
              icon="drive-file-move"
              label="Ranger dans un dossier"
              size={18}
              color={Colors.textMuted}
              style={{ marginLeft: 'auto' }}
              onPress={() => setAssignTarget(item)}
            />
            <IconAction
              icon="delete-outline"
              label="Supprimer la catégorie"
              size={18}
              color={Colors.textMuted}
              onPress={() => handleDelete(item)}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  const currentGroup = currentDossierId === null ? null : (breadcrumb[breadcrumb.length - 1] ?? null);
  const headerTitle = currentGroup?.name ?? 'Catégorie de recettes';
  const headerSub = `${visiblePlaylists.length} catégorie${visiblePlaylists.length > 1 ? 's' : ''}${childDossiers.length > 0 ? ` · ${childDossiers.length} dossier${childDossiers.length > 1 ? 's' : ''}` : ''}`;

  const ListHeader = (
    <View>
      {breadcrumb.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.breadcrumb}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          <Pressable onPress={() => setCurrentDossierId(null)}>
            <Text style={[styles.breadcrumbItem, { color: Colors.textSubtle }]}>Catégorie</Text>
          </Pressable>
          {breadcrumb.map(g => (
            <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
              <Pressable onPress={() => setCurrentDossierId(g.id)}>
                <Text
                  style={[
                    styles.breadcrumbItem,
                    { color: g.id === currentDossierId ? Colors.text : Colors.textSubtle },
                    g.id === currentDossierId && { fontWeight: FontWeight.bold },
                  ]}
                >
                  {g.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {childDossiers.length > 0 ? (
        <View style={styles.dossierGrid}>
          {childDossiers.map(g => (
            // Enveloppe non rognée : la carte elle-même a overflow:'hidden'
            // (pour que la photo épouse les coins arrondis), ce qui couperait
            // la bulle d'aide du bouton ⋮ s'il vivait à l'intérieur.
            <View key={g.id} style={styles.dossierCardWrapper}>
              <Pressable
                style={[
                  styles.dossierCard,
                  { backgroundColor: g.color + '15', borderColor: g.color + '40', overflow: 'hidden' },
                ]}
                onPress={() => setCurrentDossierId(g.id)}
                onLongPress={() => handleDossierLongPress(g)}
              >
                {g.imageUrl ? (
                  <>
                    <Image
                      source={{ uri: g.imageUrl }}
                      style={StyleSheet.absoluteFillObject as any}
                      contentFit="cover"
                    />
                    {/* Voile cantonné au bas de la tuile : le nom reste lisible
                        sans assombrir la photo entière, qui est justement ce
                        qu'on vient regarder. */}
                    <View style={styles.dossierCardScrim} />
                  </>
                ) : (
                  <View style={styles.dossierCardIcon}>
                    <MaterialIcons name="folder" size={34} color={g.color} />
                  </View>
                )}
                <View style={styles.dossierCardText}>
                  <Text
                    style={[styles.dossierCardName, { color: g.imageUrl ? '#fff' : Colors.text }]}
                    numberOfLines={2}
                  >
                    {g.name}
                  </Text>
                  <Text
                    style={[styles.dossierCardMeta, { color: g.imageUrl ? 'rgba(255,255,255,0.9)' : Colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {countChildDossiers(g.id) > 0
                      ? `${countChildDossiers(g.id)} sous-dossier${countChildDossiers(g.id) > 1 ? 's' : ''} · `
                      : ''}
                    {countDescendantCategories(g.id)} catégorie{countDescendantCategories(g.id) > 1 ? 's' : ''}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.dossierCardMenu}>
                <IconAction
                  icon="more-vert"
                  label="Renommer ou supprimer"
                  size={18}
                  color={g.imageUrl ? '#fff' : Colors.textSubtle}
                  style={[
                    styles.dossierMenuBtn,
                    { backgroundColor: g.imageUrl ? 'rgba(0,0,0,0.45)' : Colors.surface + 'E6' },
                  ]}
                  onPress={() => handleDossierLongPress(g)}
                />
              </View>
            </View>
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
            <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>
              {headerTitle}
            </Text>
            <Text style={[styles.headerSub, { color: Colors.textSubtle }]}>{headerSub}</Text>
          </View>
          {/* Une fois DANS un dossier, sa carte n'est plus affichée : sans ce
              bouton, il n'existerait aucun moyen de le renommer ou de le
              supprimer sans remonter d'un niveau. */}
          {currentGroup ? (
            <IconAction
              icon="more-vert"
              label={`Renommer ou supprimer « ${currentGroup.name} »`}
              size={22}
              color={Colors.textSubtle}
              style={styles.headerMenuBtn}
              onPress={() => handleDossierLongPress(currentGroup)}
            />
          ) : null}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            childDossiers.length > 0 ? null : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialIcons name="playlist-play" size={56} color={Colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucun categorie</Text>
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
      <Modal visible={!!dossierModal} transparent animationType="fade" onRequestClose={() => setGroupModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setGroupModal(null)}>
            <Pressable style={[styles.dossierModal, { backgroundColor: Colors.surface }]} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.dossierModalTitle, { color: Colors.text }]}>
                  {dossierModal?.mode === 'create' ? 'Nouveau dossier' : 'Modifier le dossier'}
                </Text>

                {/* Photo */}
                <Pressable
                  style={[
                    styles.dossierPhotoPicker,
                    { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border },
                  ]}
                  onPress={showDossierImageOptions}
                >
                  {dossierImageUri || dossierModal?.target?.imageUrl ? (
                    <>
                      <Image
                        source={{ uri: dossierImageUri ?? dossierModal?.target?.imageUrl }}
                        style={StyleSheet.absoluteFillObject as any}
                        contentFit="cover"
                      />
                      <View style={styles.dossierPhotoOverlay}>
                        <MaterialIcons name="edit" size={16} color="#fff" />
                        <Text style={styles.dossierPhotoOverlayText}>Modifier la photo</Text>
                      </View>
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <MaterialIcons name="add-a-photo" size={24} color={Colors.textMuted} />
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>
                        Ajouter une photo (optionnel)
                      </Text>
                    </View>
                  )}
                </Pressable>

                <TextInput
                  style={[
                    styles.dossierModalInput,
                    { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text },
                  ]}
                  placeholder="Nom du dossier..."
                  placeholderTextColor={Colors.textMuted}
                  value={dossierNameInput}
                  onChangeText={setGroupNameInput}
                  autoFocus={dossierModal?.mode === 'create'}
                  maxLength={40}
                />

                {/* Color */}
                <Text style={[styles.dossierColorLabel, { color: Colors.textSubtle }]}>Couleur</Text>
                <View style={styles.dossierColorGrid}>
                  {ACCENT_SWATCHES.map(c => (
                    <Pressable
                      key={c}
                      style={[
                        styles.dossierColorSwatch,
                        { backgroundColor: c },
                        dossierColorInput === c && styles.dossierColorSwatchActive,
                      ]}
                      onPress={() => setGroupColorInput(c)}
                    >
                      {dossierColorInput === c ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                    </Pressable>
                  ))}
                </View>

                <View style={styles.groupModalBtns}>
                  <Pressable
                    style={[styles.groupModalBtn, { borderColor: Colors.border }]}
                    onPress={() => setGroupModal(null)}
                  >
                    <Text style={[styles.groupModalBtnText, { color: Colors.textSubtle }]}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupModalBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => void handleSaveDossier()}
                    disabled={savingDossier || !dossierNameInput.trim()}
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
          <Pressable
            style={[styles.dossierModal, { backgroundColor: Colors.surface, maxHeight: '70%' }]}
            onPress={() => {}}
          >
            <Text style={[styles.dossierModalTitle, { color: Colors.text }]}>{`Dossiers de "${assignTarget?.name}"`}</Text>
            {dossiers.length === 0 ? (
              <Text style={{ fontSize: FontSize.sm, color: Colors.textSubtle, marginTop: Spacing.sm }}>
                {'Aucun dossier pour l\'instant — créez-en un depuis le bouton "+" de l\'écran Catégorie.'}
              </Text>
            ) : (
              <ScrollView style={{ marginTop: Spacing.sm }}>
                {dossiers.map(g => {
                  let depth = 0;
                  let cursor: Dossier | undefined = g;
                  while (cursor?.parentId) {
                    depth++;
                    cursor = dossiers.find(x => x.id === cursor!.parentId);
                  }
                  const checked = !!assignTarget && assignTarget.dossierIds.includes(g.id);
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
                      <Text style={[styles.assignRowText, { color: Colors.text }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable
              style={[styles.groupModalBtn, { borderColor: Colors.border, marginTop: Spacing.md }]}
              onPress={() => setAssignTarget(null)}
            >
              <Text style={[styles.groupModalBtnText, { color: Colors.textSubtle }]}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
    headerSub: { fontSize: FontSize.xs, marginTop: 2 },
    addBtn: { width: 42, height: 42, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },

    breadcrumb: { marginBottom: Spacing.sm },
    breadcrumbItem: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, paddingHorizontal: 2 },

    dossierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    dossierCardWrapper: { position: 'relative' },
    dossierCardMenu: { position: 'absolute', top: 4, right: 4 },
    dossierMenuBtn: { width: 28, height: 28, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
    headerMenuBtn: {
      width: 42,
      height: 42,
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Tuile carrée, à la Pinterest : la photo d'un dossier est l'essentiel de
    // ce qu'on regarde, et une hauteur dictée par le texte lui laissait une
    // bande de quelques pixels. aspectRatio plutôt qu'une hauteur fixe pour
    // que la tuile reste carrée si la largeur change.
    dossierCard: {
      width: 150,
      aspectRatio: 1,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      padding: Spacing.sm,
      justifyContent: 'flex-end',
    },
    dossierCardIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dossierCardText: { gap: 2 },
    dossierCardScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '55%',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dossierCardName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    dossierCardMeta: { fontSize: 10 },

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
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
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

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    dossierModal: { width: '100%', maxHeight: '85%', borderRadius: Radius.xl, padding: Spacing.lg },
    dossierModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
    dossierModalInput: {
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      fontSize: FontSize.md,
      marginBottom: Spacing.sm,
    },
    groupModalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    groupModalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center' },
    groupModalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

    dossierPhotoPicker: {
      height: 100,
      borderRadius: Radius.md,
      borderWidth: 1,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    dossierPhotoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    dossierPhotoOverlayText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.xs },
    dossierColorLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6 },
    dossierColorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    dossierColorSwatch: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dossierColorSwatchActive: {
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },

    assignRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 10,
      paddingRight: Spacing.sm,
    },
    assignRowText: { fontSize: FontSize.sm, flex: 1 },
  });
};
