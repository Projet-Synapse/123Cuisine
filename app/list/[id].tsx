// Powered by OnSpace.AI
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { SUPERMARKETS, UNITS } from '@/constants/config';
import { getPriceComparisons, PriceItem } from '@/services/priceService';

type ViewMode = 'list' | 'prix';
type Filter = 'all' | 'pending' | 'done';

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
  const [filter, setFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const list = useMemo(() => shoppingLists.find(l => l.id === id), [shoppingLists, id]);
  const supermarket = useMemo(() => SUPERMARKETS.find(s => s.id === list?.supermarketId) || SUPERMARKETS[SUPERMARKETS.length - 1], [list]);

  const priceComparisons = useMemo(() => {
    if (!list) return [];
    const priceItems: PriceItem[] = list.items.map(i => ({ category: i.category, quantity: i.quantity, unit: i.unit, checked: i.checked }));
    return getPriceComparisons(priceItems, list.supermarketId);
  }, [list]);

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
  const pendingCount = total - checked;

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
    showAlert('Supprimer ?', `Supprimer "${itemName}" de la liste ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeItemFromList(list.id, itemId) },
    ]);
  };

  const cheapest = priceComparisons[0];
  const currentSM = priceComparisons.find(p => p.isCurrent);

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
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Pressable onPress={() => router.push(`/edit-list/${list.id}`)} hitSlop={8}>
              <MaterialIcons name="edit" size={22} color={Colors.textSubtle} />
            </Pressable>
            <Pressable onPress={() => setShowAdd(!showAdd)} hitSlop={8}>
              <MaterialIcons name={showAdd ? 'close' : 'add'} size={24} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Progress */}
        <View style={[styles.progressContainer, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <View style={[styles.progressBarBg, { backgroundColor: Colors.border }]}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: supermarket.color }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.progressText, { color: Colors.textMuted }]}>{checked}/{total} articles cochés</Text>
            {pendingCount > 0 && priceComparisons.length > 0 && cheapest ? (
              <Pressable
                style={[styles.priceToggle, { backgroundColor: viewMode === 'prix' ? supermarket.color : Colors.surfaceMuted, borderColor: supermarket.color + '40' }]}
                onPress={() => setViewMode(v => v === 'list' ? 'prix' : 'list')}
              >
                <MaterialIcons name="attach-money" size={14} color={viewMode === 'prix' ? '#fff' : supermarket.color} />
                <Text style={[styles.priceToggleText, { color: viewMode === 'prix' ? '#fff' : supermarket.color }]}>
                  {viewMode === 'prix' ? 'Masquer' : 'Comparer'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Add form */}
        {showAdd ? (
          <View style={[styles.addForm, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
            <TextInput style={[styles.addInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder="Nom de l'article..." placeholderTextColor={Colors.textMuted} value={newItemName} onChangeText={setNewItemName} autoFocus />
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

        {/* Price comparison view */}
        {viewMode === 'prix' && priceComparisons.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}>
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.priceTitle, { color: Colors.text }]}>Estimation des prix</Text>
              <Text style={[styles.priceSubtitle, { color: Colors.textSubtle }]}>
                {pendingCount} article{pendingCount > 1 ? 's' : ''} restant{pendingCount > 1 ? 's' : ''} · Prix estimatifs, non contractuels
              </Text>
            </View>

            {priceComparisons.map((est, idx) => {
              const maxTotal = priceComparisons[priceComparisons.length - 1]?.estimatedTotal ?? 1;
              const barWidth = maxTotal > 0 ? (est.estimatedTotal / maxTotal) * 100 : 0;
              return (
                <View key={est.supermarketId} style={[styles.priceCard, {
                  backgroundColor: Colors.surface,
                  borderColor: est.isCurrent ? est.color : est.isCheapest ? est.color + '50' : Colors.border,
                  borderWidth: est.isCurrent || est.isCheapest ? 2 : 1,
                  ...Shadow.sm,
                }]}>
                  <View style={styles.priceCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.smDot, { backgroundColor: est.color }]} />
                        <Text style={[styles.priceName, { color: Colors.text }]}>{est.supermarketName}</Text>
                        {est.isCheapest ? (
                          <View style={[styles.badge, { backgroundColor: '#4CAF5020' }]}>
                            <Text style={[styles.badgeText, { color: '#4CAF50' }]}>Le moins cher</Text>
                          </View>
                        ) : null}
                        {est.isCurrent ? (
                          <View style={[styles.badge, { backgroundColor: est.color + '20' }]}>
                            <Text style={[styles.badgeText, { color: est.color }]}>Votre liste</Text>
                          </View>
                        ) : null}
                      </View>
                      {est.savingsVsExpensive > 0 && idx < priceComparisons.length - 1 ? (
                        <Text style={[styles.priceSavings, { color: '#4CAF50' }]}>
                          {est.isCheapest ? `Économisez ${est.savingsVsExpensive.toFixed(2)}€` : `-${est.savingsVsExpensive.toFixed(2)}€ vs le + cher`}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.priceTotal, { color: est.isCheapest ? '#4CAF50' : Colors.text }]}>
                      ~{est.estimatedTotal.toFixed(2)}€
                    </Text>
                  </View>
                  <View style={[styles.priceBarBg, { backgroundColor: Colors.border }]}>
                    <View style={[styles.priceBarFill, { width: `${barWidth}%`, backgroundColor: est.isCheapest ? '#4CAF50' : est.color }]} />
                  </View>
                </View>
              );
            })}

            <View style={[styles.priceNote, { backgroundColor: Colors.surfaceMuted }]}>
              <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
              <Text style={[styles.priceNoteText, { color: Colors.textMuted }]}>
                Prix estimés basés sur les moyennes françaises. Les prix réels varient selon les promotions et régions.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <>
            {/* Filters */}
            <View style={styles.filterBar}>
              {(['all', 'pending', 'done'] as Filter[]).map(f => (
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
                    <Pressable key={item.id} style={[styles.itemRow, { backgroundColor: Colors.surface, ...Shadow.sm }, item.checked && { opacity: 0.55 }]} onPress={() => toggleListItem(list.id, item.id)}>
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
          </>
        )}
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
  progressBarBg: { height: 8, borderRadius: Radius.round, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: Radius.round },
  progressText: { fontSize: FontSize.xs },
  priceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.round, borderWidth: 1 },
  priceToggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
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

  // Price comparison
  priceTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
  priceSubtitle: { fontSize: FontSize.xs, lineHeight: 18 },
  priceCard: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  priceCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  smDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  priceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  priceSavings: { fontSize: FontSize.xs, marginTop: 2, fontWeight: FontWeight.medium },
  priceTotal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.round },
  badgeText: { fontSize: 10, fontWeight: FontWeight.bold },
  priceBarBg: { height: 6, borderRadius: Radius.round, overflow: 'hidden' },
  priceBarFill: { height: '100%', borderRadius: Radius.round },
  priceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  priceNoteText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
});
