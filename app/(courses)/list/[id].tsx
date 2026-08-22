//////////////////////////////////////////////////////////////////////////
//                              🛒 List.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Détail d'une liste de courses : cases à cocher, comparaison de prix par supermarché, catalogue d'articles, impression.
 */

// Powered by OnSpace.AI
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { IconAction } from '@/components/IconAction';
import type { ThemeContextType, AppColors } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert } from '@/template';
import { SUPERMARKETS, UNITS } from '@/constants/config';
import {
  getPriceComparisons,
  PriceItem,
  detectUnit,
  detectCategory,
  getItemPriceBreakdown,
  getItemEstimatedPrice,
  PRODUCT_CATALOG,
  CatalogProduct,
  ItemPriceBreakdown,
  Brand,
} from '@/services/courses/priceService';
import { setLastActiveListId } from '@/services/kitchenService';
import { searchOpenFoodFactsProducts, OFFProduct } from '@/services/courses/openFoodFactsService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { printHtml, escapeHtml } from '@/utils/print';

type ViewMode = 'list' | 'prix';
type Filter = 'all' | 'pending' | 'done';

// Prend la palette en paramètre : les couleurs de gamme viennent du thème
// (elles s'adaptent au mode sombre) et ne sont plus résolvables au niveau du module.
function getBrandColor(tier: Brand['tier'], price: AppColors['price']): string {
  if (tier === 'mdd') return price.low;
  if (tier === 'standard') return price.mid;
  return price.high;
}

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const { FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { shoppingLists, toggleListItem, setAllListItemsChecked, addItemToList, removeItemFromList } = useKitchen();
  const { showAlert } = useAlert();

  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('unité(s)');
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [itemBreakdown, setItemBreakdown] = useState<ItemPriceBreakdown | null>(null);
  const [addedFromCatalog, setAddedFromCatalog] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  const list = useMemo(() => shoppingLists.find(l => l.id === id), [shoppingLists, id]);
  const supermarket = useMemo(
    () => SUPERMARKETS.find(s => s.id === list?.supermarketId) || SUPERMARKETS[SUPERMARKETS.length - 1],
    [list],
  );

  // Retient cette liste comme "liste en cours" pour le raccourci de l'accueil.
  useEffect(() => {
    if (list) void setLastActiveListId(list.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.id]);

  // Smart unit detection
  useEffect(() => {
    if (newItemName.trim().length >= 2) {
      setNewItemUnit(detectUnit(newItemName));
    }
  }, [newItemName]);

  // Recherche de vrais produits (Open Food Facts) au fil de la frappe, avec
  // anti-rebond — même logique que dans create-list.tsx.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (newItemName.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(() => {
      void searchOpenFoodFactsProducts(newItemName).then(results => {
        setSearchResults(results);
        setSearchLoading(false);
      });
    }, 350);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [newItemName]);

  const priceComparisons = useMemo(() => {
    if (!list) return [];
    const priceItems: PriceItem[] = list.items.map(i => ({
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unit: i.unit,
      checked: i.checked,
    }));
    return getPriceComparisons(priceItems, list.supermarketId);
  }, [list]);

  // Catalog filtered data
  const catalogItems = useMemo(() => {
    const q = catalogSearch.toLowerCase();
    return q
      ? PRODUCT_CATALOG.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : PRODUCT_CATALOG;
  }, [catalogSearch]);

  const catalogSections = useMemo(() => {
    const categories = [...new Set(catalogItems.map(p => p.category))].sort();
    const result: ({ type: 'header'; category: string } | { type: 'item'; product: CatalogProduct })[] = [];
    categories.forEach(cat => {
      result.push({ type: 'header', category: cat });
      catalogItems.filter(p => p.category === cat).forEach(p => result.push({ type: 'item', product: p }));
    });
    return result;
  }, [catalogItems]);

  const listItemNames = useMemo(() => new Set((list?.items ?? []).map(i => i.name.toLowerCase())), [list?.items]);

  const grouped = useMemo(() => {
    let items = list?.items ?? [];
    if (filter === 'pending') items = items.filter(i => !i.checked);
    else if (filter === 'done') items = items.filter(i => i.checked);
    const groups: Record<string, typeof items> = {};
    items.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [list?.items, filter]);

  if (!list) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Liste introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const checked = list.items.filter(i => i.checked).length;
  const total = list.items.length;
  const progress = total > 0 ? checked / total : 0;
  const pendingCount = total - checked;

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    const category = detectCategory(newItemName);
    await addItemToList(list.id, {
      name: newItemName.trim(),
      quantity: newItemQty || '1',
      unit: newItemUnit,
      category,
      checked: false,
    });
    setNewItemName('');
    setNewItemQty('');
    setSearchResults([]);
    setShowAdd(false);
  };

  const handleAddItemFromSearch = async (product: OFFProduct) => {
    await addItemToList(list.id, {
      name: product.name,
      quantity: newItemQty || '1',
      unit: product.unit,
      category: product.category,
      checked: false,
      brand: product.brand,
      imageUrl: product.imageUrl ?? undefined,
    });
    setNewItemName('');
    setNewItemQty('');
    setSearchResults([]);
  };

  const handleAddFromCatalog = async (product: CatalogProduct) => {
    await addItemToList(list.id, {
      name: product.name,
      quantity: product.typicalQty,
      unit: product.unit,
      category: product.category,
      checked: false,
    });
    setAddedFromCatalog(prev => new Set([...prev, product.name]));
  };

  const handlePrint = async () => {
    const categories = Object.keys(grouped).sort();
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(list.name)}</title>
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2C1810; padding: 32px; max-width: 700px; margin: 0 auto; }
            h1 { font-size: 26px; margin-bottom: 4px; }
            .sub { color: #8B6B5D; margin-bottom: 24px; }
            .cat-block { break-inside: avoid-page; page-break-inside: avoid; }
            h2 { font-size: 16px; border-bottom: 1px solid #E8D5C4; padding-bottom: 6px; margin-top: 24px; break-after: avoid-page; }
            ul { list-style: none; padding: 0; }
            li { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 15px; }
            .box { display: inline-block; flex-shrink: 0; width: 14px; height: 14px; border: 1.5px solid #2C1810; border-radius: 3px; }
            .checked .box { background: #2C1810; }
            .checked { color: #B8A090; text-decoration: line-through; }
            .qty { margin-left: auto; flex-shrink: 0; color: #8B6B5D; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(list.name)}</h1>
          <p class="sub">${escapeHtml(supermarket.name)}</p>
          ${categories
            .map(
              cat => `
            <div class="cat-block">
              <h2>${escapeHtml(cat)}</h2>
              <ul>
                ${grouped[cat]
                  .map(
                    item => `
                  <li class="${item.checked ? 'checked' : ''}">
                    <span class="box"></span>
                    <span>${escapeHtml(item.name)}</span>
                    <span class="qty">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</span>
                  </li>
                `,
                  )
                  .join('')}
              </ul>
            </div>
          `,
            )
            .join('')}
        </body>
      </html>
    `;
    try {
      await printHtml(html);
    } catch (err) {
      showAlert(
        'Impression impossible',
        err instanceof Error ? err.message : "Une erreur est survenue à l'impression.",
      );
    }
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    showAlert('Supprimer ?', `Supprimer "${itemName}" de la liste ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void removeItemFromList(list.id, itemId) },
    ]);
  };

  const cheapest = priceComparisons[0];
  const priceRange = (p: CatalogProduct) => {
    const prices = Object.values(p.storesPrices);
    if (!prices.length) return '';
    return `€${Math.min(...prices).toFixed(2)} – €${Math.max(...prices).toFixed(2)}`;
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
            <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>
              {list.name}
            </Text>
            <View style={[styles.smBadge, { backgroundColor: supermarket.color + '20' }]}>
              <Text style={[styles.smBadgeText, { color: supermarket.color }]}>{supermarket.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <IconAction
              icon="menu-book"
              label="Ajouter depuis une recette"
              size={22}
              color={Colors.primary}
              onPress={() => setShowCatalog(true)}
            />
            <IconAction
              icon="print"
              label="Imprimer la liste"
              size={22}
              color={Colors.textSubtle}
              onPress={() => void handlePrint()}
            />
            <IconAction
              icon="edit"
              label="Modifier la liste"
              size={22}
              color={Colors.textSubtle}
              onPress={() => router.push(`/edit-list/${list.id}`)}
            />
            <IconAction
              icon={showAdd ? 'close' : 'add'}
              label={showAdd ? "Fermer l'ajout rapide" : 'Ajouter un article'}
              size={24}
              color={Colors.text}
              onPress={() => setShowAdd(!showAdd)}
            />
          </View>
        </View>

        {/* Progress */}
        <View style={[styles.progressContainer, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <View style={[styles.progressBarBg, { backgroundColor: Colors.border }]}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: supermarket.color }]}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.progressText, { color: Colors.textMuted }]}>
              {checked}/{total} articles cochés
            </Text>
            {priceComparisons.length > 0 && cheapest ? (
              <Pressable
                style={[
                  styles.priceToggle,
                  {
                    backgroundColor: viewMode === 'prix' ? supermarket.color : Colors.surfaceMuted,
                    borderColor: supermarket.color + '40',
                  },
                ]}
                onPress={() => setViewMode(v => (v === 'list' ? 'prix' : 'list'))}
              >
                <MaterialIcons name="attach-money" size={14} color={viewMode === 'prix' ? '#fff' : supermarket.color} />
                <Text style={[styles.priceToggleText, { color: viewMode === 'prix' ? '#fff' : supermarket.color }]}>
                  {viewMode === 'prix' ? 'Masquer' : 'Comparer prix'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Add form */}
        {showAdd ? (
          <View style={[styles.addForm, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[
                  styles.addInput,
                  { flex: 1, backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text },
                ]}
                placeholder="Nom de l'article..."
                placeholderTextColor={Colors.textMuted}
                value={newItemName}
                onChangeText={setNewItemName}
                autoFocus
                onSubmitEditing={() => void handleAddItem()}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              {newItemName.trim().length >= 2 ? (
                <View
                  style={[
                    styles.detectedUnit,
                    { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' },
                  ]}
                >
                  <Text style={[styles.detectedUnitText, { color: Colors.primary }]}>{newItemUnit}</Text>
                </View>
              ) : null}
            </View>

            {/* Résultats de recherche produit (Open Food Facts) */}
            {newItemName.trim().length >= 2 ? (
              <View
                style={[styles.searchResults, { borderColor: Colors.border, backgroundColor: Colors.surfaceMuted }]}
              >
                {searchLoading ? (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator size="small" color={supermarket.color} />
                  </View>
                ) : searchResults.length === 0 ? (
                  <Text
                    style={{ fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic', padding: Spacing.sm }}
                  >
                    Aucun produit trouvé — ajoutez {`"${newItemName.trim()}"`} manuellement ci-dessous.
                  </Text>
                ) : (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                    {searchResults.map(p => {
                      const estPrice = getItemEstimatedPrice(p.category, '1', p.unit, list.supermarketId);
                      return (
                        <Pressable
                          key={p.id}
                          style={[styles.searchRow, { borderBottomColor: Colors.borderLight }]}
                          onPress={() => void handleAddItemFromSearch(p)}
                        >
                          <View style={[styles.searchThumb, { backgroundColor: Colors.surface }]}>
                            {p.imageUrl ? (
                              <Image
                                source={{ uri: p.imageUrl }}
                                style={{ width: 36, height: 36 }}
                                contentFit="contain"
                              />
                            ) : (
                              <Text style={{ fontSize: 16 }}>🛒</Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.searchRowName, { color: Colors.text }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={[styles.searchRowMeta, { color: Colors.textMuted }]} numberOfLines={1}>
                              {[p.brand, p.quantity].filter(Boolean).join(' · ') || p.category}
                            </Text>
                          </View>
                          <Text style={[styles.searchRowPrice, { color: supermarket.color }]}>
                            ~€{estPrice.toFixed(2)}
                          </Text>
                          <MaterialIcons name="add-circle" size={22} color={supermarket.color} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : null}

            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.addInput,
                  { flex: 1, backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text },
                ]}
                placeholder="Qté"
                placeholderTextColor={Colors.textMuted}
                value={newItemQty}
                onChangeText={setNewItemQty}
                keyboardType="decimal-pad"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 2 }}>
                {UNITS.map(u => (
                  <Pressable
                    key={u}
                    style={[
                      styles.unitChip,
                      {
                        backgroundColor: newItemUnit === u ? supermarket.color : Colors.surfaceMuted,
                        borderColor: newItemUnit === u ? supermarket.color : Colors.border,
                      },
                    ]}
                    onPress={() => setNewItemUnit(u)}
                  >
                    <Text style={[styles.unitText, { color: newItemUnit === u ? '#fff' : Colors.textSubtle }]}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.addItemBtn, { backgroundColor: supermarket.color }]}
                onPress={() => void handleAddItem()}
              >
                <MaterialIcons name="check" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Price comparison view */}
        {viewMode === 'prix' && priceComparisons.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <ScreenContainer style={{ padding: Spacing.md }}>
              <Text style={[styles.priceTitle, { color: Colors.text }]}>Estimation totale</Text>
              <Text style={[styles.priceSubtitle, { color: Colors.textSubtle }]}>
                {pendingCount} article{pendingCount > 1 ? 's' : ''} restant{pendingCount > 1 ? 's' : ''} · Prix
                estimatifs, non contractuels
              </Text>

              {priceComparisons.map((est, idx) => {
                const maxTotal = priceComparisons[priceComparisons.length - 1]?.estimatedTotal ?? 1;
                const barWidth = maxTotal > 0 ? (est.estimatedTotal / maxTotal) * 100 : 0;
                return (
                  <View
                    key={est.supermarketId}
                    style={[
                      styles.priceCard,
                      {
                        backgroundColor: Colors.surface,
                        borderColor: est.isCurrent ? est.color : est.isCheapest ? est.color + '50' : Colors.border,
                        borderWidth: est.isCurrent || est.isCheapest ? 2 : 1,
                        ...Shadow.sm,
                      },
                    ]}
                  >
                    <View style={styles.priceCardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.smDot, { backgroundColor: est.color }]} />
                          <Text style={[styles.priceName, { color: Colors.text }]}>{est.supermarketName}</Text>
                          {est.isCheapest ? (
                            <View style={[styles.badge, { backgroundColor: Colors.price.low + '20' }]}>
                              <Text style={[styles.badgeText, { color: Colors.price.low }]}>Le moins cher</Text>
                            </View>
                          ) : null}
                          {est.isCurrent ? (
                            <View style={[styles.badge, { backgroundColor: est.color + '20' }]}>
                              <Text style={[styles.badgeText, { color: est.color }]}>Votre liste</Text>
                            </View>
                          ) : null}
                        </View>
                        {est.savingsVsExpensive > 0 && idx < priceComparisons.length - 1 ? (
                          <Text style={[styles.priceSavings, { color: Colors.price.low }]}>
                            {est.isCheapest
                              ? `Économisez jusqu'à ${est.savingsVsExpensive.toFixed(2)}€`
                              : `-${est.savingsVsExpensive.toFixed(2)}€ vs le + cher`}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.priceTotal, { color: est.isCheapest ? Colors.price.low : Colors.text }]}>
                        ~{est.estimatedTotal.toFixed(2)}€
                      </Text>
                    </View>
                    <View style={[styles.priceBarBg, { backgroundColor: Colors.border }]}>
                      <View
                        style={[
                          styles.priceBarFill,
                          { width: `${barWidth}%`, backgroundColor: est.isCheapest ? Colors.price.low : est.color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}

              {/* Per-item breakdown section */}
              <Text style={[styles.priceTitle, { color: Colors.text, marginTop: Spacing.lg }]}>
                Comparer article par article
              </Text>
              <Text style={[styles.priceSubtitle, { color: Colors.textSubtle }]}>
                Appuyez sur un article pour voir les prix par magasin
              </Text>

              {list.items
                .filter(i => !i.checked)
                .map(item => {
                  const estPrice = getItemEstimatedPrice(item.category, item.quantity, item.unit, list.supermarketId);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.itemPriceRow, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                      onPress={() =>
                        setItemBreakdown(
                          getItemPriceBreakdown(item.name, item.category, item.quantity, item.unit, list.supermarketId),
                        )
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPriceRowName, { color: Colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemPriceRowMeta, { color: Colors.textMuted }]}>
                          {item.quantity} {item.unit} · {item.category}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.itemPriceRowEst, { color: Colors.primary }]}>~€{estPrice.toFixed(2)}</Text>
                        <View style={[styles.miniCompareBtn, { backgroundColor: Colors.primary + '15' }]}>
                          <MaterialIcons name="compare-arrows" size={12} color={Colors.primary} />
                          <Text style={[styles.miniCompareTxt, { color: Colors.primary }]}>Comparer</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}

              <View style={[styles.priceNote, { backgroundColor: Colors.surfaceMuted }]}>
                <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                <Text style={[styles.priceNoteText, { color: Colors.textMuted }]}>
                  Prix estimés sur la base des moyennes françaises. Varient selon promotions et régions.
                </Text>
              </View>
            </ScreenContainer>
          </ScrollView>
        ) : (
          <>
            <View style={styles.filterBar}>
              {(['all', 'pending', 'done'] as Filter[]).map(f => (
                <Pressable
                  key={f}
                  style={[
                    styles.filterBtn,
                    {
                      backgroundColor: filter === f ? supermarket.color : Colors.surfaceMuted,
                      borderColor: filter === f ? supermarket.color : Colors.border,
                    },
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, { color: filter === f ? '#fff' : Colors.textSubtle }]}>
                    {f === 'all' ? 'Tout' : f === 'pending' ? 'À acheter' : 'Faits'}
                  </Text>
                </Pressable>
              ))}
              {total > 0 ? (
                <Pressable
                  style={[styles.checkAllBtn, { borderColor: Colors.border, backgroundColor: Colors.surfaceMuted }]}
                  onPress={() => void setAllListItemsChecked(list.id, checked < total)}
                  accessibilityLabel={checked < total ? 'Tout cocher' : 'Tout décocher'}
                  hitSlop={6}
                >
                  <MaterialIcons
                    name={checked < total ? 'done-all' : 'remove-done'}
                    size={16}
                    color={Colors.textSubtle}
                  />
                </Pressable>
              ) : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
              <ScreenContainer>
                {Object.entries(grouped).map(([category, items]) => (
                  <View key={category} style={styles.categoryGroup}>
                    <Text style={[styles.categoryLabel, { color: Colors.textMuted }]}>{category}</Text>
                    {items.map(item => {
                      const estPrice = getItemEstimatedPrice(
                        item.category,
                        item.quantity,
                        item.unit,
                        list.supermarketId,
                      );
                      return (
                        <Pressable
                          key={item.id}
                          style={[
                            styles.itemRow,
                            { backgroundColor: Colors.surface, ...Shadow.sm },
                            item.checked && { opacity: 0.55 },
                          ]}
                          onPress={() => void toggleListItem(list.id, item.id)}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: item.checked ? supermarket.color : Colors.border,
                                backgroundColor: item.checked ? supermarket.color : 'transparent',
                              },
                            ]}
                          >
                            {item.checked ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                          </View>
                          {item.imageUrl ? (
                            <View style={[styles.itemThumb, { backgroundColor: Colors.surfaceMuted }]}>
                              <Image
                                source={{ uri: item.imageUrl }}
                                style={{ width: 30, height: 30 }}
                                contentFit="contain"
                              />
                            </View>
                          ) : null}
                          <Text
                            style={[
                              styles.itemName,
                              { color: Colors.text },
                              item.checked && { textDecorationLine: 'line-through', color: Colors.textMuted },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text style={[styles.itemQty, { color: Colors.textSubtle }]}>
                            {item.quantity} {item.unit}
                          </Text>
                          <Text style={[styles.itemEstPrice, { color: Colors.primary }]}>~€{estPrice.toFixed(2)}</Text>
                          <Pressable
                            onPress={() =>
                              setItemBreakdown(
                                getItemPriceBreakdown(
                                  item.name,
                                  item.category,
                                  item.quantity,
                                  item.unit,
                                  list.supermarketId,
                                ),
                              )
                            }
                            hitSlop={8}
                            style={styles.priceIconBtn}
                          >
                            <MaterialIcons name="store" size={16} color={Colors.primary} />
                          </Pressable>
                          <Pressable onPress={() => handleRemoveItem(item.id, item.name)} hitSlop={8}>
                            <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                {Object.keys(grouped).length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 80, gap: Spacing.sm }}>
                    <Text style={{ fontSize: 48 }}>🛒</Text>
                    <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text }}>
                      Liste vide
                    </Text>
                    <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle }}>
                      Appuyez sur + pour ajouter des articles
                    </Text>
                    <Pressable
                      style={[styles.catalogHintBtn, { backgroundColor: Colors.primary + '15' }]}
                      onPress={() => setShowCatalog(true)}
                    >
                      <MaterialIcons name="menu-book" size={16} color={Colors.primary} />
                      <Text style={[styles.catalogHintText, { color: Colors.primary }]}>Parcourir le catalogue</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScreenContainer>
            </ScrollView>
          </>
        )}

        {/* ── CATALOG MODAL ── */}
        {showCatalog ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background, zIndex: 100 }]}>
            <View
              style={[
                styles.catalogHeader,
                { paddingTop: insets.top, backgroundColor: Colors.surface, borderBottomColor: Colors.border },
              ]}
            >
              <Pressable
                onPress={() => {
                  setShowCatalog(false);
                  setCatalogSearch('');
                }}
                hitSlop={8}
              >
                <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
              </Pressable>
              <View style={{ flex: 1, marginHorizontal: Spacing.md }}>
                <Text style={[styles.catalogTitle, { color: Colors.text }]}>{"Catalogue d'articles"}</Text>
                <Text style={[styles.catalogSub, { color: Colors.textSubtle }]}>
                  Appuyez sur + pour ajouter à votre liste
                </Text>
              </View>
            </View>

            <View
              style={[styles.catalogSearchBar, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
            >
              <MaterialIcons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={[styles.catalogSearchInput, { color: Colors.text }]}
                placeholder="Rechercher un article..."
                placeholderTextColor={Colors.textMuted}
                value={catalogSearch}
                onChangeText={setCatalogSearch}
                autoCorrect={false}
              />
              {catalogSearch ? (
                <Pressable onPress={() => setCatalogSearch('')} hitSlop={8}>
                  <MaterialIcons name="clear" size={18} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScreenContainer style={{ flex: 1, width: '100%' }}>
              <FlatList
                data={catalogSections}
                keyExtractor={(item, idx) =>
                  item.type === 'header' ? `h-${item.category}` : `i-${(item as any).product.name}-${idx}`
                }
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  if (item.type === 'header') {
                    return (
                      <View style={[styles.catalogCatHeader, { borderBottomColor: Colors.border }]}>
                        <Text style={[styles.catalogCatText, { color: Colors.textMuted }]}>
                          {item.category.toUpperCase()}
                        </Text>
                      </View>
                    );
                  }
                  const p = (item as any).product as CatalogProduct;
                  const alreadyInList = listItemNames.has(p.name.toLowerCase());
                  const justAdded = addedFromCatalog.has(p.name);
                  const smPrice = p.storesPrices[list.supermarketId];
                  return (
                    <View style={[styles.catalogRow, { borderBottomColor: Colors.borderLight }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catalogRowName, { color: Colors.text }]}>{p.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <Text style={[styles.catalogRowMeta, { color: Colors.textMuted }]}>
                            {p.typicalQty} {p.unit}
                          </Text>
                          <Text style={[styles.catalogRowRange, { color: Colors.primary }]}>{priceRange(p)}</Text>
                          {smPrice ? (
                            <Text style={[styles.catalogRowSm, { color: supermarket.color }]}>
                              {supermarket.name}: €{smPrice.toFixed(2)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Pressable
                        style={[
                          styles.catalogAddBtn,
                          {
                            backgroundColor: alreadyInList || justAdded ? Colors.secondary + '20' : supermarket.color,
                            borderColor: alreadyInList || justAdded ? Colors.secondary : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          if (!alreadyInList) void handleAddFromCatalog(p);
                        }}
                      >
                        <MaterialIcons
                          name={alreadyInList || justAdded ? 'check' : 'add'}
                          size={18}
                          color={alreadyInList || justAdded ? Colors.secondary : '#fff'}
                        />
                      </Pressable>
                    </View>
                  );
                }}
              />
            </ScreenContainer>
          </View>
        ) : null}

        {/* ── ITEM BREAKDOWN MODAL ── */}
        {itemBreakdown ? (
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 200 }]}>
            <Pressable style={styles.breakdownBackdrop} onPress={() => setItemBreakdown(null)} />
            <View
              style={[styles.breakdownSheet, { backgroundColor: Colors.surface, paddingBottom: insets.bottom + 16 }]}
            >
              <View style={styles.breakdownHandle} />
              <View style={styles.breakdownHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.breakdownTitle, { color: Colors.text }]} numberOfLines={1}>
                    {itemBreakdown.itemName}
                  </Text>
                  <Text style={[styles.breakdownMeta, { color: Colors.textSubtle }]}>
                    {itemBreakdown.quantity} {itemBreakdown.unit} · {itemBreakdown.category}
                  </Text>
                </View>
                <Pressable onPress={() => setItemBreakdown(null)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={Colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                {/* Store prices */}
                <Text style={[styles.breakdownSectionTitle, { color: Colors.textSubtle }]}>PRIX PAR MAGASIN</Text>
                {itemBreakdown.storePrices.map((sp, idx) => (
                  <View
                    key={sp.supermarketId}
                    style={[
                      styles.breakdownStoreRow,
                      {
                        borderBottomColor: Colors.borderLight,
                        borderBottomWidth: idx < itemBreakdown.storePrices.length - 1 ? 1 : 0,
                      },
                    ]}
                  >
                    <View style={[styles.smDotSm, { backgroundColor: sp.color }]} />
                    <Text style={[styles.breakdownStoreName, { color: Colors.text }]}>{sp.supermarketName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {sp.isCurrent ? (
                        <View style={[styles.badge, { backgroundColor: sp.color + '20' }]}>
                          <Text style={[styles.badgeText, { color: sp.color }]}>Votre liste</Text>
                        </View>
                      ) : null}
                      {sp.isCheapest ? (
                        <View style={[styles.badge, { backgroundColor: Colors.price.low + '20' }]}>
                          <Text style={[styles.badgeText, { color: Colors.price.low }]}>+ Pas cher</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.breakdownStorePrice,
                        { color: sp.isCheapest ? Colors.price.low : sp.isCurrent ? sp.color : Colors.text },
                      ]}
                    >
                      ~€{sp.price.toFixed(2)}
                    </Text>
                  </View>
                ))}

                {/* Brand alternatives */}
                <Text style={[styles.breakdownSectionTitle, { color: Colors.textSubtle, marginTop: Spacing.md }]}>
                  ALTERNATIVES DE MARQUES
                </Text>
                {itemBreakdown.brands.map(brand => (
                  <View
                    key={brand.name}
                    style={[
                      styles.brandRow,
                      {
                        borderColor: getBrandColor(brand.tier, Colors.price) + '25',
                        backgroundColor: getBrandColor(brand.tier, Colors.price) + '08',
                      },
                    ]}
                  >
                    <View style={[styles.brandTierBadge, { backgroundColor: getBrandColor(brand.tier, Colors.price) }]}>
                      <Text style={styles.brandTierText}>
                        {brand.tier === 'mdd' ? 'MDD' : brand.tier === 'standard' ? 'STD' : 'PRE'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.brandName, { color: Colors.text }]}>{brand.name}</Text>
                      <Text style={[styles.brandDesc, { color: Colors.textSubtle }]} numberOfLines={1}>
                        {brand.description}
                      </Text>
                    </View>
                    <Text style={[styles.brandPrice, { color: getBrandColor(brand.tier, Colors.price) }]}>
                      ~€{brand.pricePerUnit.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 3,
    },
    headerCenter: { flex: 1, marginHorizontal: Spacing.md },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    smBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.round,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    smBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    progressContainer: { padding: Spacing.md, borderBottomWidth: 1 },
    progressBarBg: { height: 8, borderRadius: Radius.round, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', borderRadius: Radius.round },
    progressText: { fontSize: FontSize.xs },
    priceToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.round,
      borderWidth: 1,
    },
    priceToggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    addForm: { padding: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
    addInput: {
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: FontSize.md,
      borderWidth: 1,
    },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, marginRight: 4, borderWidth: 1 },
    unitText: { fontSize: FontSize.xs },
    addItemBtn: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    detectedUnit: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
    detectedUnitText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    searchResults: { borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
    searchLoading: { padding: Spacing.md, alignItems: 'center' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderBottomWidth: 1,
    },
    searchThumb: {
      width: 36,
      height: 36,
      borderRadius: Radius.sm,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    searchRowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    searchRowMeta: { fontSize: 11, marginTop: 1 },
    searchRowPrice: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    itemThumb: { width: 30, height: 30, borderRadius: Radius.sm, marginRight: Spacing.sm, overflow: 'hidden' },
    filterBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
    filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1 },
    checkAllBtn: {
      width: 36,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    categoryGroup: { marginHorizontal: Spacing.md, marginBottom: Spacing.md },
    categoryLabel: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      marginBottom: Spacing.sm,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      marginRight: Spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
    itemQty: { fontSize: FontSize.sm, marginRight: 4 },
    itemEstPrice: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginRight: 4 },
    priceIconBtn: { padding: 4, marginRight: 4 },
    catalogHintBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radius.md,
      marginTop: Spacing.sm,
    },
    catalogHintText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    // Price comparison
    priceTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 4 },
    priceSubtitle: { fontSize: FontSize.xs, lineHeight: 18, marginBottom: Spacing.md },
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
    priceNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginTop: Spacing.sm,
    },
    priceNoteText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
    itemPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    itemPriceRowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    itemPriceRowMeta: { fontSize: 11 },
    itemPriceRowEst: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    miniCompareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: Radius.round,
      marginTop: 2,
    },
    miniCompareTxt: { fontSize: 10, fontWeight: FontWeight.semibold },

    // Catalog modal
    catalogHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      paddingTop: Spacing.sm,
      borderBottomWidth: 1,
    },
    catalogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    catalogSub: { fontSize: FontSize.xs, marginTop: 2 },
    catalogSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
    },
    catalogSearchInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.md },
    catalogCatHeader: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
    catalogCatText: { fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      borderBottomWidth: 1,
    },
    catalogRowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    catalogRowMeta: { fontSize: 11 },
    catalogRowRange: { fontSize: 11, fontWeight: FontWeight.semibold },
    catalogRowSm: { fontSize: 11, fontWeight: FontWeight.bold },
    catalogAddBtn: {
      width: 34,
      height: 34,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: Spacing.sm,
      borderWidth: 1,
    },

    // Item breakdown
    breakdownBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    breakdownSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.md,
      paddingTop: 8,
    },
    breakdownHandle: {
      width: 40,
      height: 4,
      backgroundColor: '#E0E0E0',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    breakdownHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
    breakdownTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    breakdownMeta: { fontSize: FontSize.xs, marginTop: 2 },
    breakdownSectionTitle: { fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8, marginBottom: Spacing.sm },
    breakdownStoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
    smDotSm: { width: 10, height: 10, borderRadius: 5 },
    breakdownStoreName: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    breakdownStorePrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: 6,
      gap: 10,
      borderWidth: 1,
    },
    brandTierBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: Radius.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandTierText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
    brandName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    brandDesc: { fontSize: 11, marginTop: 1 },
    brandPrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  });
};
