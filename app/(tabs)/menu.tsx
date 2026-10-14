//////////////////////////////////////////////////////////////////////////
//                          📅 Menu.tsx (onglet)                        //
//////////////////////////////////////////////////////////////////////////

/*
 * Menu de la semaine : planning kanban des repas. Sept colonnes (lundi ->
 * dimanche), chacune découpée en créneaux horaires de 8h à 20h où l'on
 * place des plats (recettes) ; navigation de semaine en semaine, partage
 * du menu avec d'autres inscrits (écran /menu-share/[id]).
 *
 * Pas de drag-and-drop dans le projet : le déplacement d'un plat passe par
 * un panneau « Déplacer » (jour + créneau de destination), comme le
 * réordonnancement se fait par boutons dans les catégories.
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { IconAction } from '@/components/IconAction';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { useWeeklyMenu } from '@/hooks/useWeeklyMenu';
import { useAuth, useAlert } from '@/template';
import { Recipe, PublicRecipe } from '@/services/kitchenService';
import {
  WeeklyMenuEntry,
  getWeekStart,
  fromDateKey,
} from '@/services/menus/weeklyMenuService';
import { ScreenContainer } from '@/components/ScreenContainer';
import { RecipePicker } from '@/components/menu/RecipePicker';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export default function WeeklyMenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { width, isWide } = useResponsive();
  const { recipes, publicRecipes } = useKitchen();
  const { menus, loading, refreshMenus, createMenu, deleteMenu, addDish, removeDish, moveDish } = useWeeklyMenu();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // 0 = semaine courante, -1 = semaine précédente, +1 = suivante...
  const [weekOffset, setWeekOffset] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<{ day: number; hour: number } | null>(null);
  const [moveEntry, setMoveEntry] = useState<WeeklyMenuEntry | null>(null);
  const [moveDay, setMoveDay] = useState(0);

  const weekStart = getWeekStart(new Date(Date.now() + weekOffset * 7 * 24 * 3600 * 1000));
  const menu = useMemo(() => menus.find(m => m.weekStart === weekStart), [menus, weekStart]);

  // En local (invité), tout m'appartient ; en compte, seul le propriétaire
  // supprime le menu — les membres invités ne font qu'organiser les plats.
  const isOwner = menu ? (user ? menu.ownerId === user.id : true) : false;

  const todayIndex = (new Date().getDay() + 6) % 7;
  const isCurrentWeek = weekOffset === 0;

  // Largeur d'une colonne : une journée entière par page sur mobile, et des
  // colonnes scrollables façon Trello sur écran large (la grille est bornée
  // par ScreenContainer à Layout.maxContentWidth).
  const boardWidth = Math.min(width, Layout.maxContentWidth);
  const columnWidth = isWide ? 176 : boardWidth;

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  const formatWeekLabel = (startKey: string) => {
    const start = fromDateKey(startKey);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date, withMonth: boolean) =>
      d.toLocaleDateString('fr-FR', withMonth ? { day: 'numeric', month: 'long' } : { day: 'numeric' });
    const startLabel = fmt(start, start.getMonth() !== end.getMonth());
    return `Semaine du ${startLabel} au ${fmt(end, true)}`;
  };

  // Résolution d'un plat : d'abord les recettes chargées (les miennes puis
  // la communauté), sinon l'instantané saisi au placement (cf.
  // WeeklyMenuEntry) — la carte reste lisible même si la recette a depuis
  // été renommée, supprimée ou n'est pas visible par le lecteur.
  const resolveEntry = (entry: WeeklyMenuEntry) => {
    const recipe = [...recipes, ...publicRecipes].find(r => r.id === entry.recipeId);
    return {
      title: recipe?.title ?? entry.title ?? 'Recette indisponible',
      image: recipe?.image ?? entry.image,
    };
  };

  const handleCreateMenu = () => {
    void createMenu(weekStart, formatWeekLabel(weekStart));
  };

  const handleShare = () => {
    if (!menu) return;
    if (!user) {
      showAlert('Connexion requise', 'Créez un compte ou connectez-vous pour partager vos menus avec vos proches.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => router.push('/login') },
      ]);
      return;
    }
    router.push(`/menu-share/${menu.id}` as never);
  };

  const handleDeleteMenu = () => {
    if (!menu) return;
    showAlert('Supprimer le menu ?', `« ${menu.name} » sera supprimé pour tous ses membres.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteMenu(menu.id) },
    ]);
  };

  const handleSelectRecipe = (recipe: Recipe | PublicRecipe) => {
    if (!pickerSlot || !menu) return;
    void addDish(menu.id, pickerSlot.day, pickerSlot.hour, {
      recipeId: recipe.id,
      title: recipe.title,
      image: recipe.image,
    });
    setPickerSlot(null);
  };

  const handleConfirmMove = (toDay: number, toHour: number) => {
    if (!menu || !moveEntry) return;
    void moveDish(menu.id, moveEntry.id, toDay, toHour);
    setMoveEntry(null);
  };

  // ── Panneau de placement : choix de la recette ──
  if (pickerSlot) {
    return (
      <RecipePicker
        visible
        title={`Placer un plat · ${DAYS[pickerSlot.day]} ${pickerSlot.hour}h`}
        onClose={() => setPickerSlot(null)}
        onSelect={handleSelectRecipe}
      />
    );
  }

  // ── Panneau de déplacement : jour de destination puis créneau ──
  if (moveEntry) {
    const dayEntries = (menu?.days[moveDay] ?? []).filter(e => e.id !== moveEntry.id);
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={[styles.panelHeader, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <Pressable onPress={() => setMoveEntry(null)} hitSlop={8}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </Pressable>
          <Text style={[styles.panelTitle, { color: Colors.text }]}>Déplacer « {resolveEntry(moveEntry).title} »</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScreenContainer style={{ width: '100%' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: Spacing.sm }}>
            {DAYS.map((day, idx) => (
              <Pressable
                key={day}
                style={[styles.dayChip, moveDay === idx && { backgroundColor: Colors.primary }]}
                onPress={() => setMoveDay(idx)}
              >
                <Text style={[styles.dayChipText, { color: moveDay === idx ? '#fff' : Colors.text }]}>{day.slice(0, 3)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScreenContainer>

        <ScreenContainer style={{ flex: 1, width: '100%' }}>
          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.moveHint, { color: Colors.textMuted }]}>
              Choisissez le créneau de destination pour {DAYS[moveDay].toLowerCase()} :
            </Text>
            {HOURS.map(hour => {
              const count = dayEntries.filter(e => e.hour === hour).length;
              return (
                <Pressable
                  key={hour}
                  style={[styles.moveRow, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                  onPress={() => handleConfirmMove(moveDay, hour)}
                >
                  <Text style={[styles.moveHour, { color: Colors.text }]}>{hour}h</Text>
                  <Text style={[styles.moveCount, { color: Colors.textMuted }]}>
                    {count > 0 ? `${count} plat${count > 1 ? 's' : ''}` : 'Libre'}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color={Colors.primary} />
                </Pressable>
              );
            })}
          </ScrollView>
        </ScreenContainer>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScreenContainer style={{ width: '100%' }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Menu de la semaine</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <IconAction icon="person-add" label="Partager ce menu" onPress={handleShare} disabled={!menu} />
            {menu && isOwner ? (
              <IconAction icon="delete-outline" label="Supprimer le menu" onPress={handleDeleteMenu} />
            ) : null}
          </View>
        </View>

        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setWeekOffset(o => o - 1)}
            hitSlop={8}
            style={styles.weekArrow}
            accessibilityLabel="Semaine précédente"
          >
            <MaterialIcons name="chevron-left" size={26} color={Colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.weekLabel, { color: Colors.text }]}>{formatWeekLabel(weekStart)}</Text>
            {isCurrentWeek ? (
              <View style={[styles.weekBadge, { backgroundColor: Colors.primary + '15' }]}>
                <Text style={[styles.weekBadgeText, { color: Colors.primary }]}>Cette semaine</Text>
              </View>
            ) : (
              <Pressable onPress={() => setWeekOffset(0)} hitSlop={6}>
                <Text style={[styles.backToToday, { color: Colors.primary }]}>{"Revenir à aujourd'hui"}</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setWeekOffset(o => o + 1)}
            hitSlop={8}
            style={styles.weekArrow}
            accessibilityLabel="Semaine suivante"
          >
            <MaterialIcons name="chevron-right" size={26} color={Colors.text} />
          </Pressable>
        </View>
      </ScreenContainer>

      {menu ? (
        <ScreenContainer style={{ flex: 1, width: '100%' }}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshMenus()} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled={!isWide}>
              <View style={{ flexDirection: 'row', paddingHorizontal: isWide ? Spacing.md : 0, gap: isWide ? Spacing.sm : 0 }}>
                {DAYS.map((day, dayIdx) => {
                  const entries = menu.days[dayIdx] ?? [];
                  const isToday = isCurrentWeek && dayIdx === todayIndex;
                  return (
                    <View key={day} style={[styles.column, { width: columnWidth }]}>
                      <View style={[styles.columnHeader, isToday && { backgroundColor: Colors.primary }]}>
                        <Text style={[styles.columnDay, { color: isToday ? '#fff' : Colors.text }]}>{day}</Text>
                        <Text style={[styles.columnDate, { color: isToday ? 'rgba(255,255,255,0.8)' : Colors.textMuted }]}>
                          {fromDateKey(addDays(weekStart, dayIdx)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>

                      {HOURS.map(hour => {
                        const hourEntries = entries.filter(e => e.hour === hour);
                        return (
                          <View key={hour} style={styles.hourRow}>
                            <Text style={[styles.hourLabel, { color: Colors.textMuted }]}>{hour}h</Text>
                            <View style={styles.hourSlot}>
                              {hourEntries.map(entry => {
                                const { title, image } = resolveEntry(entry);
                                return (
                                  // Carte entière = ouvrir la fiche recette ;
                                  // les boutons d'action, imbriqués, captent
                                  // leurs propres appuis (comportement RN).
                                  <Pressable
                                    key={entry.id}
                                    style={[styles.dishCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}
                                    onPress={() => router.push(`/recipe/${entry.recipeId}` as never)}
                                  >
                                    {image ? (
                                      <View style={[styles.dishThumb, { backgroundColor: Colors.surfaceMuted, overflow: 'hidden' }]}>
                                        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                      </View>
                                    ) : null}
                                    <Text style={[styles.dishTitle, { color: Colors.text }]} numberOfLines={2}>
                                      {title}
                                    </Text>
                                    <View style={styles.dishActions}>
                                      <Pressable
                                        onPress={() => {
                                          setMoveEntry(entry);
                                          setMoveDay(dayIdx);
                                        }}
                                        hitSlop={6}
                                        accessibilityLabel="Déplacer le plat"
                                      >
                                        <MaterialIcons name="open-with" size={17} color={Colors.textMuted} />
                                      </Pressable>
                                      {/* Retrait direct, sans confirmation : le
                                          geste d'organisation doit rester fluide,
                                          le plat se remet en un tap. */}
                                      <Pressable
                                        onPress={() => void removeDish(menu.id, dayIdx, entry.id)}
                                        hitSlop={6}
                                        accessibilityLabel="Retirer le plat du menu"
                                      >
                                        <MaterialIcons name="close" size={17} color={Colors.textMuted} />
                                      </Pressable>
                                    </View>
                                  </Pressable>
                                );
                              })}
                              <Pressable
                                style={[styles.emptySlot, { borderColor: Colors.border }]}
                                onPress={() => setPickerSlot({ day: dayIdx, hour })}
                                accessibilityLabel={`Placer un plat à ${hour}h le ${day.toLowerCase()}`}
                              >
                                <MaterialIcons name="add" size={15} color={Colors.textMuted} />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </ScreenContainer>
      ) : (
        <ScreenContainer style={{ flex: 1, width: '100%' }}>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 56 }}>📅</Text>
            <Text style={[styles.emptyTitle, { color: Colors.text }]}>Aucun menu pour cette semaine</Text>
            <Text style={[styles.emptyDesc, { color: Colors.textMuted }]}>
              Composez votre planning de repas jour par jour, de 8h à 20h, puis partagez-le.
            </Text>
            <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.primary }]} onPress={handleCreateMenu}>
              <Text style={styles.emptyBtnText}>Créer le menu</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      )}
    </View>
  );
}

// Petit utilitaire local : date + n jours, rendue en clé 'YYYY-MM-DD'.
function addDays(weekStartKey: string, days: number): string {
  const d = fromDateKey(weekStartKey);
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },

    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    weekArrow: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    weekLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    weekBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.round, marginTop: 2 },
    weekBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    backToToday: { fontSize: FontSize.xs, marginTop: 3 },

    column: { paddingHorizontal: Spacing.sm },
    columnHeader: {
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      marginBottom: Spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.03)',
    },
    columnDay: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    columnDate: { fontSize: FontSize.xs },

    hourRow: { flexDirection: 'row', marginBottom: Spacing.xs },
    hourLabel: { width: 26, fontSize: FontSize.xs, paddingTop: 7 },
    hourSlot: { flex: 1, gap: Spacing.xs },

    dishCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    dishThumb: { width: 30, height: 30, borderRadius: Radius.sm },
    dishTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, lineHeight: 15 },
    dishActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    emptySlot: {
      height: 26,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      opacity: 0.7,
    },

    dayChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.round,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    dayChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    moveHint: { fontSize: FontSize.sm },
    moveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    moveHour: { fontSize: FontSize.md, fontWeight: FontWeight.bold, width: 44 },
    moveCount: { fontSize: FontSize.sm, flex: 1 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    emptyDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    emptyBtn: { paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: Radius.round, marginTop: Spacing.sm },
    emptyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      gap: Spacing.sm,
    },
    panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1 },
  });
};
