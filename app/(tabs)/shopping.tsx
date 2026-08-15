//////////////////////////////////////////////////////////////////////////
//                             Shopping.ts                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Liste des listes de courses de l'utilisateur, groupées par supermarché.
 */

import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { ShoppingList } from '@/services/kitchenService';
import { SUPERMARKETS } from '@/constants/config';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useResponsive } from '@/hooks/useResponsive';

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { shoppingLists, deleteShoppingList } = useKitchen();
  const { showAlert } = useAlert();
  const { columns } = useResponsive();

  const getSupermarket = (id: string) => SUPERMARKETS.find(s => s.id === id) || SUPERMARKETS[SUPERMARKETS.length - 1];

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const handleDelete = (list: ShoppingList) => {
    showAlert('Supprimer la liste', `Supprimer "${list.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteShoppingList(list.id) },
    ]);
  };

  const usedSupermarkets = Array.from(new Set(shoppingLists.map(l => l.supermarketId))).map(id => getSupermarket(id));

  const renderList = ({ item }: { item: ShoppingList }) => {
    const supermarket = getSupermarket(item.supermarketId);
    const checked = item.items.filter(i => i.checked).length;
    const total = item.items.length;
    const progress = total > 0 ? checked / total : 0;
    return (
      <Pressable style={[styles.listCard, columns > 1 && { flex: 1 }, { backgroundColor: Colors.surface, ...Shadow.sm }]} onPress={() => router.push(`/list/${item.id}`)}>
        <View style={[styles.listColorBar, { backgroundColor: supermarket.color }]} />
        <View style={styles.listContent}>
          <View style={styles.listHeader}>
            <View style={styles.listInfo}>
              <Text style={[styles.listName, { color: Colors.text }]}>{item.name}</Text>
              <View style={[styles.smBadge, { backgroundColor: supermarket.color + '20' }]}>
                <Text style={[styles.smBadgeText, { color: supermarket.color }]}>{supermarket.name}</Text>
              </View>
            </View>
            <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.progressArea}>
            <View style={[styles.progressBar, { backgroundColor: Colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: supermarket.color }]} />
            </View>
            <Text style={[styles.progressLabel, { color: Colors.textMuted }]}>{checked}/{total} articles</Text>
          </View>
          <View style={styles.categorySummary}>
            {Object.entries(
              item.items.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {} as Record<string, number>)
            ).slice(0, 3).map(([cat, count]) => (
              <View key={cat} style={[styles.catChip, { backgroundColor: Colors.surfaceMuted }]}>
                <Text style={[styles.catChipText, { color: Colors.textSubtle }]}>{cat} ({count})</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Mes Courses</Text>
          <Pressable style={[styles.addBtn, { backgroundColor: Colors.secondary }]} onPress={() => router.push('/create-list')}>
            <MaterialIcons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        {usedSupermarkets.length > 0 ? (
          <View style={{ marginBottom: Spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: 4 }}>
              {usedSupermarkets.map(sm => (
                <View key={sm.id} style={[styles.smChip, { backgroundColor: sm.color + '20', borderColor: sm.color + '40' }]}>
                  <Text style={[styles.smChipText, { color: sm.color }]}>{sm.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScreenContainer>

      <ScreenContainer style={{ flex: 1, width: '100%' }}>
        <FlatList
          key={columns}
          data={shoppingLists}
          renderItem={renderList}
          keyExtractor={item => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: Spacing.md } : undefined}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 56 }}>🛒</Text>
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucune liste de courses</Text>
              <Text style={[styles.emptyDesc, { color: Colors.textSubtle }]}>{"Créez votre première liste !"}</Text>
              <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.secondary }]} onPress={() => router.push('/create-list')}>
                <Text style={styles.emptyBtnText}>Créer une liste</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  addBtn: { width: 40, height: 40, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  listCard: { borderRadius: Radius.lg, flexDirection: 'row', overflow: 'hidden' },
  listColorBar: { width: 5 },
  listContent: { flex: 1, padding: Spacing.md },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  listInfo: { flex: 1 },
  listName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  smBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.round, alignSelf: 'flex-start', marginTop: 4 },
  smBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  progressArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  progressBar: { flex: 1, height: 6, borderRadius: Radius.round, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.round },
  progressLabel: { fontSize: FontSize.xs, width: 70 },
  categorySummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round },
  catChipText: { fontSize: 10 },
  smChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  smChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyDesc: { fontSize: FontSize.md },
  emptyBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: Radius.md },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
