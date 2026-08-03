// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { RecipePlaylist } from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useResponsive } from '@/hooks/useResponsive';

const PLAYLIST_ICONS = ['playlist-play', 'restaurant', 'local-dining', 'outdoor-grill', 'cake', 'ramen-dining', 'lunch-dining', 'dinner-dining'] as const;

function getPlaylistIcon(index: number) {
  return PLAYLIST_ICONS[index % PLAYLIST_ICONS.length];
}

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { playlists, recipes, deletePlaylist } = useKitchen();
  const { showAlert } = useAlert();
  const { columns } = useResponsive();

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  const handleDelete = (playlist: RecipePlaylist) => {
    showAlert('Supprimer la playlist ?', `"${playlist.name}" sera supprimée définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deletePlaylist(playlist.id) },
    ]);
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
            <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: Colors.text }]}>Playlists</Text>
            <Text style={[styles.headerSub, { color: Colors.textSubtle }]}>
              {playlists.length > 0 ? `${playlists.length} playlist${playlists.length > 1 ? 's' : ''}` : 'Organisez vos menus'}
            </Text>
          </View>
          <Pressable
            style={[styles.addBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/create-playlist')}
          >
            <MaterialIcons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </ScreenContainer>

      <ScreenContainer style={{ flex: 1, width: '100%' }}>
        <FlatList
          key={columns}
          data={playlists}
          renderItem={renderPlaylist}
          keyExtractor={item => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: Spacing.md } : undefined}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: Colors.primary + '18' }]}>
                <MaterialIcons name="playlist-play" size={56} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucune playlist</Text>
              <Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>
                {'Créez des collections de recettes\npour vos repas de la semaine, dîners\nou occasions spéciales.'}
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: Colors.primary }]}
                onPress={() => router.push('/create-playlist')}
              >
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Créer une playlist</Text>
              </Pressable>
            </View>
          }
        />
      </ScreenContainer>
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
});
