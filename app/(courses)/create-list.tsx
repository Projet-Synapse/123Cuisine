//////////////////////////////////////////////////////////////////////////
//                         CreateList.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Formulaire de création d'une nouvelle liste de courses.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { SUPERMARKETS, INGREDIENT_CATEGORIES, UNITS } from '@/constants/config';
import { ListItem, generateId } from '@/services/kitchenService';
import { getItemEstimatedPrice } from '@/services/courses/priceService';
import { searchOpenFoodFactsProducts, OFFProduct } from '@/services/courses/openFoodFactsService';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function CreateListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { addShoppingList } = useKitchen();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [selectedSupermarket, setSelectedSupermarket] = useState(SUPERMARKETS[0]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemUnit, setItemUnit] = useState('unité(s)');
  const [itemCategory, setItemCategory] = useState('Légumes');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  // Recherche de vrais produits (Open Food Facts) au fil de la frappe, avec
  // un léger anti-rebond pour ne pas spammer l'API à chaque lettre tapée.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (itemName.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(() => {
      void searchOpenFoodFactsProducts(itemName).then(results => {
        setSearchResults(results);
        setSearchLoading(false);
      });
    }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [itemName]);

  const addItem = () => {
    if (!itemName.trim()) return;
    setItems(prev => [...prev, { id: generateId(), name: itemName.trim(), quantity: itemQty || '1', unit: itemUnit, category: itemCategory, checked: false }]);
    setItemName(''); setItemQty(''); setSearchResults([]);
  };

  const addItemFromSearch = (product: OFFProduct) => {
    setItems(prev => [...prev, {
      id: generateId(), name: product.name, quantity: itemQty || '1', unit: product.unit,
      category: product.category, checked: false, brand: product.brand, imageUrl: product.imageUrl,
    }]);
    setItemName(''); setItemQty(''); setSearchResults([]);
  };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Champ requis', 'Donnez un nom à votre liste.'); return; }
    await addShoppingList({ name: name.trim(), supermarketId: selectedSupermarket.id, items, color: selectedSupermarket.color });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="close" size={24} color={Colors.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Nouvelle liste</Text>
          <Pressable style={[styles.saveBtn, { backgroundColor: Colors.secondary }]} onPress={() => void handleSave()}>
            <Text style={styles.saveBtnText}>Créer</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          <ScreenContainer style={{ maxWidth: 640 }}>
          {/* Name */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Nom de la liste</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <TextInput style={[styles.input, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder={"Ex: Courses de la semaine..."} placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
            </View>
          </View>

          {/* Supermarket */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Supermarché</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
              {SUPERMARKETS.map(sm => (
                <Pressable key={sm.id} style={[styles.smCard, { backgroundColor: Colors.surface, borderColor: selectedSupermarket.id === sm.id ? sm.color : Colors.border, borderWidth: selectedSupermarket.id === sm.id ? 2 : 1, ...Shadow.sm }]} onPress={() => setSelectedSupermarket(sm)}>
                  <View style={[styles.smColorDot, { backgroundColor: sm.color }]} />
                  <Text style={[styles.smName, { color: selectedSupermarket.id === sm.id ? sm.color : Colors.textSubtle, fontWeight: selectedSupermarket.id === sm.id ? FontWeight.bold : FontWeight.medium }]}>{sm.name}</Text>
                  {selectedSupermarket.id === sm.id ? <MaterialIcons name="check-circle" size={16} color={sm.color} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Items */}
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Articles</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              {items.length > 0 ? (
                <View style={{ marginBottom: Spacing.md }}>
                  {items.map(item => (
                    <View key={item.id} style={[styles.itemRow, { borderBottomColor: Colors.borderLight }]}>
                      <View style={[styles.itemDot, { backgroundColor: selectedSupermarket.color }]} />
                      <Text style={[styles.itemName, { color: Colors.text }]}>{item.name}</Text>
                      <Text style={[styles.itemQty, { color: Colors.textSubtle }]}>{item.quantity} {item.unit}</Text>
                      <Pressable onPress={() => setItems(p => p.filter(i => i.id !== item.id))} hitSlop={8}>
                        <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic', marginBottom: Spacing.md }}>Aucun article ajouté</Text>}

              <TextInput style={[styles.input, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text, marginBottom: Spacing.sm }]} placeholder={"Nom de l'article (ex: jus d'orange...)"} placeholderTextColor={Colors.textMuted} value={itemName} onChangeText={setItemName} />

              {/* Résultats de recherche produit (Open Food Facts) */}
              {itemName.trim().length >= 2 ? (
                <View style={[styles.searchResults, { borderColor: Colors.border, backgroundColor: Colors.surfaceMuted }]}>
                  {searchLoading ? (
                    <View style={styles.searchLoading}><ActivityIndicator size="small" color={selectedSupermarket.color} /></View>
                  ) : searchResults.length === 0 ? (
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic', padding: Spacing.sm }}>
                      Aucun produit trouvé — vous pouvez ajouter {`"${itemName.trim()}"`} manuellement ci-dessous.
                    </Text>
                  ) : (
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                      {searchResults.map(p => {
                        const estPrice = getItemEstimatedPrice(p.category, '1', p.unit, selectedSupermarket.id);
                        return (
                          <Pressable key={p.id} style={[styles.searchRow, { borderBottomColor: Colors.borderLight }]} onPress={() => addItemFromSearch(p)}>
                            <View style={[styles.searchThumb, { backgroundColor: Colors.surface }]}>
                              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: 36, height: 36 }} contentFit="contain" /> : <Text style={{ fontSize: 16 }}>🛒</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.searchRowName, { color: Colors.text }]} numberOfLines={1}>{p.name}</Text>
                              <Text style={[styles.searchRowMeta, { color: Colors.textMuted }]} numberOfLines={1}>
                                {[p.brand, p.quantity].filter(Boolean).join(' · ') || p.category}
                              </Text>
                            </View>
                            <Text style={[styles.searchRowPrice, { color: selectedSupermarket.color }]}>~€{estPrice.toFixed(2)}</Text>
                            <MaterialIcons name="add-circle" size={22} color={selectedSupermarket.color} />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder="Quantité" placeholderTextColor={Colors.textMuted} value={itemQty} onChangeText={setItemQty} keyboardType="decimal-pad" />
                <View style={{ width: Spacing.sm }} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {UNITS.map(u => (
                    <Pressable key={u} style={[styles.unitChip, { backgroundColor: itemUnit === u ? selectedSupermarket.color : Colors.surfaceMuted, borderColor: itemUnit === u ? selectedSupermarket.color : Colors.border }]} onPress={() => setItemUnit(u)}>
                      <Text style={[styles.unitText, { color: itemUnit === u ? '#fff' : Colors.textSubtle }]}>{u}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
                {INGREDIENT_CATEGORIES.slice(0, 8).map(cat => (
                  <Pressable key={cat} style={[styles.catChip, { backgroundColor: itemCategory === cat ? selectedSupermarket.color + '20' : Colors.surfaceMuted, borderColor: itemCategory === cat ? selectedSupermarket.color : Colors.border }]} onPress={() => setItemCategory(cat)}>
                    <Text style={[styles.catText, { color: itemCategory === cat ? selectedSupermarket.color : Colors.textSubtle }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={[styles.addItemBtn, { backgroundColor: selectedSupermarket.color }]} onPress={addItem}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.addItemBtnText}>{"Ajouter l'article"}</Text>
              </Pressable>
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
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.md, borderWidth: 1 },
  searchResults: { borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
  searchLoading: { padding: Spacing.md, alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1 },
  searchThumb: { width: 36, height: 36, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  searchRowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  searchRowMeta: { fontSize: 11, marginTop: 1 },
  searchRowPrice: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  smCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  smColorDot: { width: 12, height: 12, borderRadius: 6 },
  smName: { fontSize: FontSize.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  itemName: { flex: 1, fontSize: FontSize.md },
  itemQty: { fontSize: FontSize.sm, marginRight: Spacing.sm },
  unitChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.sm, marginRight: 4, borderWidth: 1 },
  unitText: { fontSize: FontSize.xs },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.round, marginRight: 6, borderWidth: 1 },
  catText: { fontSize: FontSize.xs },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md, borderRadius: Radius.md, paddingVertical: 10 },
  addItemBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});
