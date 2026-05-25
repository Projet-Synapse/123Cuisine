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
import { SUPERMARKETS, UNITS } from '@/constants/config';

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { Colors } = useAppTheme();
  const { shoppingLists, toggleListItem, addItemToList, removeItemFromList } = useKitchen();
  const { showAlert } = useAlert();

  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('unité(s)');
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const list = useMemo(() => shoppingLists.find(l => l.id === id), [shoppingLists, id]);
  const supermarket = useMemo(() => SUPERMARKETS.find(s => s.id === list?.supermarketId) || SUPERMARKETS[SUPERMARKETS.length - 1], [list]);

  if (!list) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Liste introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}><Text style={{ color: Colors.primary }}>Retour</Text></Pressable>
      </View>
    );
  }

  const checked = list.items.filter(i => i.checked).length;
  const total = list.items.length;
  const progress = total > 0 ? checked / total : 0;

  const grouped = useMemo(() => {
    let items = list.items;
    if (filter === 'pending') items = items.filter(i => !i.checked);
    else if (filter === 'done') items = items.filter(i => i.checked);
    const groups: Record<string, typeof items> = {};
    items.forEach(item => { if (!groups[item.category]) groups[item.category] = []; groups[item.category].push(item); });
    return groups;
  }, [list.items, filter]);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    await addItemToList(list.id, { name: newItemName.trim(), quantity: newItemQty || '1', unit: newItemUnit, category: 'Autre', checked: false });
    setNewItemName(''); setNewItemQty(''); setShowAdd(false);
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    showAlert('Supprimer', `Supprimer "${itemName}" de la liste ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeItemFromList(list.id, itemId) },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: supermarket.color }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>{list.name}</Text>
            <View style={[styles.smBadge, { backgroundColor: supermarket.color + '20' }]}>
              <Text style={[styles.smBadgeText, { color: supermarket.color }]}>{supermarket.name}</Text>
            </View>
          </View>
          <Pressable onPress={() => setShowAdd(!showAdd)} hitSlop={8}>
            <MaterialIcons name={showAdd ? 'close' : 'add'} size={24} color={Colors.text} />
          </Pressable>
        </View>

        {/* Progress */}
        <View style={[styles.progressContainer, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <View style={[styles.progressBarBg, { backgroundColor: Colors.border }]}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: supermarket.color }]} />
          </View>
          <Text style={[styles.progressText, { color: Colors.textMuted }]}>{checked}/{total} articles cochés</Text>
        </View>

        {/* Add form */}
        {showAdd ? (
          <View style={[styles.addForm, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
            <TextInput style={[styles.addInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder={"Nom de l'article..."} placeholderTextColor={Colors.textMuted} value={newItemName} onChangeText={setNewItemName} autoFocus />
            <View style={styles.addRow}>
              <TextInput style={[styles.addInput, { flex: 1, backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder="Qté" placeholderTextColor={Colors.textMuted} value={newItemQty} onChangeText={setNewItemQty} keyboardType="decimal-pad" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 2 }}>
                {UNITS.slice(0, 5).map(u => (
                  <Pressable key={u} style={[styles.unitChip, { backgroundColor: newItemUnit === u ? supermarket.color : Colors.surfaceMuted, borderColor: newItemUnit === u ? supermarket.color : Colors.border }]} onPress={() => setNewItemUnit(u)}>
                    <Text style={[styles.unitText, { color: newItemUnit === u ? '#fff' : Colors.textSubtle }]}>{u}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={[styles.addItemBtn, { backgroundColor: supermarket.color }]} onPress={handleAddItem}>
                <MaterialIcons name="check" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Filters */}
        <View style={styles.filterBar}>
          {(['all', 'pending', 'done'] as const).map(f => (
            <Pressable key={f} style={[styles.filterBtn, { backgroundColor: filter === f ? supermarket.color : Colors.surfaceMuted, borderColor: filter === f ? supermarket.color : Colors.border }]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, { color: filter === f ? '#fff' : Colors.textSubtle }]}>{f === 'all' ? 'Tout' : f === 'pending' ? 'À acheter' : 'Faits'}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {Object.entries(grouped).map(([category, items]) => (
            <View key={category} style={styles.categoryGroup}>
              <Text style={[styles.categoryLabel, { color: Colors.textMuted }]}>{category}</Text>
              {items.map(item => (
                <Pressable key={item.id} style={[styles.itemRow, { backgroundColor: Colors.surface, ...Shadow.sm }, item.checked && { opacity: 0.6 }]} onPress={() => toggleListItem(list.id, item.id)}>
                  <View style={[styles.checkbox, { borderColor: item.checked ? supermarket.color : Colors.border, backgroundColor: item.checked ? supermarket.color : 'transparent' }]}>
                    {item.checked ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.itemName, { color: Colors.text }, item.checked && { textDecorationLine: 'line-through', color: Colors.textMuted }]}>{item.name}</Text>
                  <Text style={[styles.itemQty, { color: Colors.textSubtle }]}>{item.quantity} {item.unit}</Text>
                  <Pressable onPress={() => handleRemoveItem(item.id, item.name)} hitSlop={8}>
                    <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ))}
          {Object.keys(grouped).length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 80, gap: Spacing.sm }}>
              <Text style={{ fontSize: 48 }}>🛒</Text>
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text }}>Liste vide</Text>
              <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle }}>Appuyez sur + pour ajouter des articles</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 3 },
  headerCenter: { flex: 1, marginHorizontal: Spacing.md },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  smBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.round, alignSelf: 'flex-start', marginTop: 2 },
  smBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  progressContainer: { padding: Spacing.md, borderBottomWidth: 1 },
  progressBarBg: { height: 8, borderRadius: Radius.round, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', borderRadius: Radius.round },
  progressText: { fontSize: FontSize.xs, textAlign: 'right' },
  addForm: { padding: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  addInput: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.md, borderWidth: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, marginRight: 4, borderWidth: 1 },
  unitText: { fontSize: FontSize.xs },
  addItemBtn: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  filterBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1 },
  filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  categoryGroup: { marginHorizontal: Spacing.md, marginBottom: Spacing.md },
  categoryLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, marginBottom: Spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, marginRight: Spacing.md, justifyContent: 'center', alignItems: 'center' },
  itemName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  itemQty: { fontSize: FontSize.sm, marginRight: Spacing.sm },
});
