//////////////////////////////////////////////////////////////////////////
//                           ✏️ EditList.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Formulaire d'édition d'une liste de courses existante.
 */

// Powered by OnSpace.AI
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { SUPERMARKETS } from '@/constants/config';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function EditListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { shoppingLists, updateShoppingList } = useKitchen();
  const { showAlert } = useAlert();

  const list = useMemo(() => shoppingLists.find(l => l.id === id), [shoppingLists, id]);

  const [name, setName] = useState(list?.name ?? '');
  const [selectedSupermarket, setSelectedSupermarket] = useState(
    SUPERMARKETS.find(s => s.id === list?.supermarketId) ?? SUPERMARKETS[0]
  );

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  if (!list) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Liste introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: Colors.primary }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Champ requis', 'Donnez un nom à votre liste.'); return; }
    await updateShoppingList({ ...list, name: name.trim(), supermarketId: selectedSupermarket.id, color: selectedSupermarket.color });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Modifier la liste</Text>
          <Pressable style={[styles.saveBtn, { backgroundColor: Colors.secondary }]} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          <ScreenContainer style={{ maxWidth: 640 }}>
          {/* Name */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Nom de la liste</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]}
                placeholder="Ex: Courses de la semaine..."
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>
          </View>

          {/* Supermarket */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Supermarché</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {SUPERMARKETS.map(sm => (
                <Pressable
                  key={sm.id}
                  style={[styles.smCard, { backgroundColor: Colors.surface, borderColor: selectedSupermarket.id === sm.id ? sm.color : Colors.border, borderWidth: selectedSupermarket.id === sm.id ? 2 : 1, ...Shadow.sm }]}
                  onPress={() => setSelectedSupermarket(sm)}
                >
                  <View style={[styles.smColorDot, { backgroundColor: sm.color }]} />
                  <Text style={[styles.smName, { color: selectedSupermarket.id === sm.id ? sm.color : Colors.textSubtle, fontWeight: selectedSupermarket.id === sm.id ? FontWeight.bold : FontWeight.medium }]}>{sm.name}</Text>
                  {selectedSupermarket.id === sm.id ? <MaterialIcons name="check-circle" size={16} color={sm.color} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Preview */}
          <View style={[styles.previewCard, { backgroundColor: selectedSupermarket.color + '15', borderColor: selectedSupermarket.color + '40', borderWidth: 1.5 }]}>
            <View style={[styles.smColorDot, { backgroundColor: selectedSupermarket.color, width: 16, height: 16 }]} />
            <View>
              <Text style={[styles.previewName, { color: Colors.text }]}>{name || 'Nom de la liste'}</Text>
              <Text style={[styles.previewSub, { color: selectedSupermarket.color }]}>{selectedSupermarket.name} · {list.items.length} article{list.items.length > 1 ? 's' : ''}</Text>
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
  saveBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: Radius.md },
  saveBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, borderWidth: 1 },
  smCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  smColorDot: { width: 12, height: 12, borderRadius: 6 },
  smName: { fontSize: FontSize.sm },
  previewCard: { borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  previewName: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  previewSub: { fontSize: FontSize.xs, marginTop: 2 },
});
