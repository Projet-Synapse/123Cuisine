// Powered by OnSpace.AI
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { ScreenContainer } from '@/components/ScreenContainer';

const COVER_COLORS = [
  { label: 'Terracotta', value: '#C0705A' }, { label: 'Sauge', value: '#6B8F71' },
  { label: 'Ardoise', value: '#5E7A8A' }, { label: 'Ambré', value: '#D4824A' },
  { label: 'Prune', value: '#7E5A8A' }, { label: 'Émeraude', value: '#3A8A72' },
  { label: 'Framboise', value: '#B0405A' }, { label: 'Indigo', value: '#4A5EA0' },
];

export default function EditPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { playlists, recipes, updatePlaylist } = useKitchen();
  const { showAlert } = useAlert();

  const playlist = useMemo(() => playlists.find(p => p.id === id), [playlists, id]);

  const [name, setName] = useState(playlist?.name ?? '');
  const [description, setDescription] = useState(playlist?.description ?? '');
  const [coverColor, setCoverColor] = useState(playlist?.coverColor ?? COVER_COLORS[0].value);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(playlist?.recipeIds ?? []);
  const [search, setSearch] = useState('');

  const Shadow = { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 };

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

  const filteredRecipes = recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()));
  const toggleRecipe = (rid: string) => setSelectedRecipeIds(prev => prev.includes(rid) ? prev.filter(x => x !== rid) : [...prev, rid]);

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Champ requis', 'Donnez un nom à votre playlist.'); return; }
    await updatePlaylist({ ...playlist, name: name.trim(), description: description.trim(), coverColor, recipeIds: selectedRecipeIds });
    router.back();
  };

  const inputStyle = { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Modifier la playlist</Text>
          <Pressable style={[styles.saveBtn, { backgroundColor: Colors.primary }]} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          <ScreenContainer style={{ maxWidth: 640 }}>
          {/* Preview */}
          <View style={[styles.preview, { backgroundColor: coverColor }]}>
            <MaterialIcons name="playlist-play" size={48} color="rgba(255,255,255,0.9)" />
            <Text style={styles.previewName} numberOfLines={1}>{name || 'Nom de la playlist'}</Text>
            {selectedRecipeIds.length > 0 ? (
              <Text style={styles.previewCount}>{selectedRecipeIds.length} recette{selectedRecipeIds.length > 1 ? 's' : ''}</Text>
            ) : null}
          </View>

          {/* Name & Description */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Informations</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
              <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Nom *</Text>
              <TextInput style={inputStyle} placeholder="Nom de la playlist..." placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
              <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Description</Text>
              <TextInput style={[inputStyle, { minHeight: 60, paddingTop: 10 }]} placeholder="Description..." placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
            </View>
          </View>

          {/* Color */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Couleur</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
              <View style={styles.colorGrid}>
                {COVER_COLORS.map(c => (
                  <Pressable key={c.value} style={[styles.colorSwatch, { backgroundColor: c.value }, coverColor === c.value && styles.colorSwatchActive]} onPress={() => setCoverColor(c.value)}>
                    {coverColor === c.value ? <MaterialIcons name="check" size={18} color="#fff" /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Recipe picker */}
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recettes</Text>
              {selectedRecipeIds.length > 0 ? (
                <View style={[styles.selBadge, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.selBadgeText}>{selectedRecipeIds.length}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
              <TextInput style={[inputStyle, { marginBottom: Spacing.sm }]} placeholder="Rechercher une recette..." placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
              {filteredRecipes.map((recipe, idx) => {
                const isSelected = selectedRecipeIds.includes(recipe.id);
                return (
                  <Pressable key={recipe.id} style={[styles.recipeRow, { borderBottomColor: Colors.borderLight, borderBottomWidth: idx < filteredRecipes.length - 1 ? 1 : 0, backgroundColor: isSelected ? coverColor + '10' : 'transparent' }]} onPress={() => toggleRecipe(recipe.id)}>
                    <View style={[styles.recipeThumb, { backgroundColor: Colors.surfaceMuted, overflow: 'hidden' }]}>
                      {recipe.image ? <Image source={{ uri: recipe.image }} style={{ width: 40, height: 40 }} contentFit="cover" /> : <Text style={{ fontSize: 20 }}>🍽️</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipeName, { color: Colors.text }]} numberOfLines={1}>{recipe.title}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{recipe.duration} min · {recipe.difficulty}</Text>
                    </View>
                    <View style={[styles.checkbox, { borderColor: isSelected ? coverColor : Colors.border, backgroundColor: isSelected ? coverColor : 'transparent' }]}>
                      {isSelected ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
              {filteredRecipes.length === 0 ? (
                <Text style={{ color: Colors.textMuted, fontStyle: 'italic', fontSize: FontSize.sm }}>Aucune recette trouvée</Text>
              ) : null}
            </View>
          </View>
          </ScreenContainer>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  saveBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: Radius.md, minWidth: 70, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  preview: { height: 130, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg, gap: 6 },
  previewName: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  previewCount: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1 },
  selBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  selBadgeText: { color: '#fff', fontSize: 12, fontWeight: FontWeight.bold },
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6, marginTop: Spacing.sm },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorSwatch: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.md, borderRadius: Radius.sm, paddingHorizontal: 4 },
  recipeThumb: { width: 40, height: 40, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  recipeName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
});
