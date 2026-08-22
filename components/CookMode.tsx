//////////////////////////////////////////////////////////////////////////
//                            CookMode.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Mode cuisine plein écran : une étape à la fois en gros caractères, pour
 * suivre une recette les mains dans la pâte sans avoir à faire défiler
 * une longue liste. Affiche aussi la liste d'ingrédients (mise à
 * l'échelle des portions choisies) en un coup d'œil.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { Recipe, Ingredient } from '@/services/kitchenService';

interface CookModeProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  onClose: () => void;
}

export function CookMode({ recipe, ingredients, onClose }: CookModeProps) {
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const { FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const [stepIndex, setStepIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);

  const total = recipe.steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= total - 1;

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background, zIndex: 300 }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: Colors.border }]}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Quitter le mode cuisine">
          <MaterialIcons name="close" size={26} color={Colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors.text }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Pressable
          onPress={() => setShowIngredients(v => !v)}
          hitSlop={8}
          accessibilityLabel="Afficher les ingrédients"
        >
          <MaterialIcons
            name={showIngredients ? 'menu-book' : 'list-alt'}
            size={24}
            color={showIngredients ? Colors.primary : Colors.text}
          />
        </Pressable>
      </View>

      {showIngredients ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg }}>
          <Text style={[styles.ingTitle, { color: Colors.text }]}>Ingrédients</Text>
          {ingredients.map(ing => (
            <View key={ing.id} style={[styles.ingRow, { borderBottomColor: Colors.borderLight }]}>
              <View style={[styles.ingDot, { backgroundColor: Colors.primary }]} />
              <Text style={[styles.ingName, { color: Colors.text }]}>{ing.name}</Text>
              <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle, fontWeight: FontWeight.semibold }}>
                {ing.quantity} {ing.unit}
              </Text>
            </View>
          ))}
          <Pressable
            style={[styles.backToStepsBtn, { backgroundColor: Colors.primary }]}
            onPress={() => setShowIngredients(false)}
          >
            <MaterialIcons name="restaurant" size={18} color="#fff" />
            <Text style={styles.backToStepsBtnText}>Retour aux étapes</Text>
          </Pressable>
        </ScrollView>
      ) : total === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle }}>
            {"Cette recette n'a pas d'étapes détaillées."}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.progressRow}>
            {recipe.steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= stepIndex ? Colors.primary : Colors.border, flex: i === stepIndex ? 2 : 1 },
                ]}
              />
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepCount, { color: Colors.primary }]}>
              ÉTAPE {stepIndex + 1} / {total}
            </Text>
            <Text style={[styles.stepText, { color: Colors.text }]}>{recipe.steps[stepIndex]}</Text>
          </ScrollView>

          <View style={[styles.navBar, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: Colors.border }]}>
            <Pressable
              style={[styles.navBtn, { backgroundColor: Colors.surfaceMuted, opacity: isFirst ? 0.4 : 1 }]}
              onPress={() => setStepIndex(i => Math.max(0, i - 1))}
              disabled={isFirst}
            >
              <MaterialIcons name="chevron-left" size={26} color={Colors.text} />
              <Text style={[styles.navBtnText, { color: Colors.text }]}>Précédent</Text>
            </Pressable>
            {isLast ? (
              <Pressable
                style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: Colors.secondary }]}
                onPress={onClose}
              >
                <MaterialIcons name="check" size={22} color="#fff" />
                <Text style={[styles.navBtnText, { color: '#fff' }]}>Terminé</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: Colors.primary }]}
                onPress={() => setStepIndex(i => Math.min(total - 1, i + 1))}
              >
                <Text style={[styles.navBtnText, { color: '#fff' }]}>Suivant</Text>
                <MaterialIcons name="chevron-right" size={26} color="#fff" />
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
    },
    headerTitle: {
      flex: 1,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      textAlign: 'center',
      marginHorizontal: Spacing.sm,
    },

    progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    progressDot: { height: 4, borderRadius: 2 },

    stepScrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    stepCount: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      letterSpacing: 1.2,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    stepText: { fontSize: 26, lineHeight: 36, fontWeight: FontWeight.medium, textAlign: 'center' },

    navBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1 },
    navBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 14,
      borderRadius: Radius.md,
    },
    navBtnPrimary: { flex: 1.4 },
    navBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },

    ingTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
    ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    ingDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.md },
    ingName: { flex: 1, fontSize: FontSize.lg },
    backToStepsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radius.md,
      paddingVertical: 14,
      marginTop: Spacing.lg,
    },
    backToStepsBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  });
};
