//////////////////////////////////////////////////////////////////////////
//                             🍳 Recipe.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Détail d'une recette : ingrédients, étapes, favoris, ajout à une liste de courses, impression.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { IconAction } from '@/components/IconAction';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useKitchen } from '@/hooks/useKitchen';
import { useAlert, useAuth } from '@/template';
import { ScreenContainer } from '@/components/ScreenContainer';
import { printHtml, escapeHtml } from '@/utils/print';
import { scaleQuantity } from '@/utils/servings';
import { CookMode } from '@/components/CookMode';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  const { Colors } = t;
  const { FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { recipes, shoppingLists, toggleFavorite, togglePublic, deleteRecipe, addRecipeToList } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [cookMode, setCookMode] = useState(false);

  const recipe = useMemo(() => recipes.find(r => r.id === id), [recipes, id]);

  // Portions choisies pour l'affichage : démarre sur la valeur de la
  // recette, ajustable avec le stepper sans modifier la recette enregistrée.
  const [servingsCount, setServingsCount] = useState(recipe?.servings ?? 4);
  useEffect(() => {
    if (recipe) setServingsCount(recipe.servings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  const servingsFactor = recipe && recipe.servings > 0 ? servingsCount / recipe.servings : 1;
  const scaledIngredients = useMemo(
    () =>
      (recipe?.ingredients ?? []).map(ing => ({ ...ing, quantity: scaleQuantity(ing.quantity ?? '', servingsFactor) })),
    [recipe, servingsFactor],
  );

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  if (!recipe) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textSubtle }}>Recette introuvable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: Colors.primary }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    showAlert('Supprimer la recette', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteRecipe(recipe.id);
            router.back();
          })();
        },
      },
    ]);
  };

  const handlePrint = async () => {
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(recipe.title)}</title>
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2C1810; padding: 32px; max-width: 700px; margin: 0 auto; }
            .photo { width: 100%; max-height: 320px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; }
            h1 { font-size: 26px; margin-bottom: 4px; }
            .desc { color: #8B6B5D; margin-bottom: 16px; }
            .meta { display: flex; gap: 24px; margin-bottom: 24px; color: #2C1810; }
            .meta div { font-size: 14px; }
            h2 { font-size: 18px; border-bottom: 1px solid #E8D5C4; padding-bottom: 6px; margin-top: 28px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 6px; }
            ol { padding-left: 20px; }
            ol li { margin-bottom: 12px; line-height: 1.5; }
          </style>
        </head>
        <body>
          ${recipe.image ? `<img class="photo" src="${escapeHtml(recipe.image)}" alt="" />` : ''}
          <h1>${escapeHtml(recipe.title)}</h1>
          <p class="desc">${escapeHtml(recipe.description)}</p>
          <div class="meta">
            <div><strong>Durée :</strong> ${recipe.duration} min</div>
            <div><strong>Personnes :</strong> ${recipe.servings}</div>
            <div><strong>Difficulté :</strong> ${escapeHtml(recipe.difficulty)}</div>
          </div>
          <h2>Ingrédients</h2>
          <ul>
            ${recipe.ingredients.map(ing => `<li>${escapeHtml(ing.name)}${ing.quantity ? ` — ${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit ?? '')}` : ''}</li>`).join('')}
          </ul>
          <h2>Étapes</h2>
          <ol>
            ${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
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

  const handleTogglePublic = () => {
    if (!user) {
      showAlert('Connexion requise', 'Connectez-vous pour partager vos recettes publiquement.');
      return;
    }
    const goingPublic = !recipe.isPublic;
    showAlert(
      goingPublic ? 'Rendre publique' : 'Rendre privée',
      goingPublic
        ? 'Cette recette sera visible par les autres utilisateurs et pourra apparaître dans les recommandations.'
        : 'Cette recette ne sera plus visible que par vous.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => void togglePublic(recipe.id) },
      ],
    );
  };

  const handleAddToList = () => {
    if (shoppingLists.length === 0) {
      showAlert('Aucune liste', "Créez d'abord une liste de courses.");
      return;
    }
    showAlert('Ajouter à une liste', 'Choisissez une liste :', [
      ...shoppingLists.map(list => ({
        text: list.name,
        onPress: async () => {
          await addRecipeToList(list.id, recipe);
          showAlert('Ajouté !', `Ingrédients ajoutés à "${list.name}".`);
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={[styles.heroArea, { paddingTop: insets.top, backgroundColor: Colors.surfaceMuted }]}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={StyleSheet.absoluteFillObject as any}>
              <Text
                style={{ fontSize: 64, position: 'absolute', top: '50%', left: '50%', marginLeft: -32, marginTop: -32 }}
              >
                🍽️
              </Text>
            </View>
          )}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          <View style={[styles.heroControls, { top: insets.top + Spacing.md }]}>
            <IconAction
              icon="arrow-back"
              label="Retour"
              color="#fff"
              style={styles.iconBtn}
              onPress={() => router.back()}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <IconAction
                icon={recipe.isFavorite ? 'favorite' : 'favorite-border'}
                label={recipe.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                color={recipe.isFavorite ? Colors.favorite : '#fff'}
                style={styles.iconBtn}
                onPress={() => void toggleFavorite(recipe.id)}
              />
              <IconAction
                icon={recipe.isPublic ? 'public' : 'lock'}
                label={recipe.isPublic ? 'Publique — la rendre privée' : 'Privée — la rendre publique'}
                color={recipe.isPublic ? '#4CD964' : '#fff'}
                style={styles.iconBtn}
                onPress={handleTogglePublic}
              />
              <IconAction
                icon="edit"
                label="Modifier la recette"
                color="#fff"
                style={styles.iconBtn}
                onPress={() => router.push(`/edit-recipe/${recipe.id}`)}
              />
              <IconAction
                icon="print"
                label="Imprimer la recette"
                color="#fff"
                style={styles.iconBtn}
                onPress={() => void handlePrint()}
              />
              <IconAction
                icon="delete-outline"
                label="Supprimer la recette"
                color="#fff"
                style={styles.iconBtn}
                onPress={handleDelete}
              />
            </View>
          </View>
        </View>

        <ScreenContainer style={{ maxWidth: 720, padding: Spacing.md }}>
          <Text style={[styles.title, { color: Colors.text }]}>{recipe.title}</Text>
          <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle, lineHeight: 22, marginBottom: Spacing.md }}>
            {recipe.description}
          </Text>

          {/* Meta */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
            {[
              { icon: 'schedule', color: Colors.primary, value: `${recipe.duration} min`, label: 'Durée' },
              { icon: 'star', color: Colors.accent, value: recipe.difficulty, label: 'Difficulté' },
            ].map(m => (
              <View key={m.label} style={[styles.metaCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
                <MaterialIcons name={m.icon as any} size={20} color={m.color} />
                <Text style={[styles.metaValue, { color: Colors.text }]}>{m.value}</Text>
                <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{m.label}</Text>
              </View>
            ))}

            {/* Stepper de portions : ajuste l'affichage des quantités sans modifier la recette enregistrée */}
            <View
              style={[
                styles.metaCard,
                { backgroundColor: Colors.surface, ...Shadow.sm, paddingHorizontal: Spacing.sm },
              ]}
            >
              <MaterialIcons name="people" size={20} color={Colors.secondary} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Pressable
                  onPress={() => setServingsCount(c => Math.max(1, c - 1))}
                  hitSlop={6}
                  style={[styles.servingsStepBtn, { backgroundColor: Colors.surfaceMuted }]}
                  accessibilityLabel="Moins de portions"
                >
                  <MaterialIcons name="remove" size={13} color={Colors.text} />
                </Pressable>
                <Text style={[styles.metaValue, { color: Colors.text, minWidth: 16, textAlign: 'center' }]}>
                  {servingsCount}
                </Text>
                <Pressable
                  onPress={() => setServingsCount(c => Math.min(50, c + 1))}
                  hitSlop={6}
                  style={[styles.servingsStepBtn, { backgroundColor: Colors.surfaceMuted }]}
                  accessibilityLabel="Plus de portions"
                >
                  <MaterialIcons name="add" size={13} color={Colors.text} />
                </Pressable>
              </View>
              <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Personnes</Text>
            </View>
          </View>
          {servingsFactor !== 1 ? (
            <Pressable
              onPress={() => setServingsCount(recipe.servings)}
              style={{ marginTop: -Spacing.sm, marginBottom: Spacing.md }}
            >
              <Text style={{ fontSize: FontSize.xs, color: Colors.primary }}>
                {`Quantités recalculées pour ${servingsCount} · recette d'origine pour ${recipe.servings} — réinitialiser`}
              </Text>
            </Pressable>
          ) : null}

          {/* Tags */}
          {recipe.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md }}>
              {recipe.tags.map(tag => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: Colors.primary + '15' }]}>
                  <Text style={[styles.tagChipText, { color: Colors.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Tab row */}
          <View style={[styles.tabRow, { backgroundColor: Colors.surfaceMuted }]}>
            {(['ingredients', 'steps'] as const).map(t => (
              <Pressable
                key={t}
                style={[styles.tab, activeTab === t && { backgroundColor: Colors.surface, ...Shadow.sm }]}
                onPress={() => setActiveTab(t)}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: activeTab === t ? Colors.primary : Colors.textMuted,
                      fontWeight: activeTab === t ? FontWeight.bold : FontWeight.medium,
                    },
                  ]}
                >
                  {t === 'ingredients'
                    ? `Ingrédients (${recipe.ingredients.length})`
                    : `Étapes (${recipe.steps.length})`}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'ingredients' ? (
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              {scaledIngredients.map((ing, idx) => (
                <View
                  key={ing.id}
                  style={[
                    styles.ingredientRow,
                    idx < scaledIngredients.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.borderLight,
                    },
                  ]}
                >
                  <View style={[styles.ingDot, { backgroundColor: Colors.primary }]} />
                  <Text style={[styles.ingName, { color: Colors.text }]}>{ing.name}</Text>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSubtle, fontWeight: FontWeight.medium }}>
                    {ing.quantity} {ing.unit}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {recipe.steps.map((step, idx) => (
                <View key={idx} style={[styles.stepCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
                  <View style={[styles.stepNumber, { backgroundColor: Colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>{idx + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, lineHeight: 22 }}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </ScreenContainer>
      </ScrollView>

      {/* CTA */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            paddingBottom: insets.bottom + Spacing.sm,
            flexDirection: 'row',
            gap: Spacing.sm,
          },
        ]}
      >
        <Pressable style={[styles.ctaBtn, { flex: 1, backgroundColor: Colors.secondary }]} onPress={handleAddToList}>
          <MaterialIcons name="shopping-cart" size={20} color="#fff" />
          <Text style={styles.ctaBtnText}>Ajouter à une liste</Text>
        </Pressable>
        <Pressable
          style={[styles.ctaBtn, { flex: 1, backgroundColor: Colors.primary }]}
          onPress={() => setCookMode(true)}
        >
          <MaterialIcons name="restaurant" size={20} color="#fff" />
          <Text style={styles.ctaBtnText}>Mode cuisine</Text>
        </Pressable>
      </View>

      {cookMode ? (
        <CookMode recipe={recipe} ingredients={scaledIngredients} onClose={() => setCookMode(false)} />
      ) : null}
    </View>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    heroArea: { height: 240, position: 'relative', justifyContent: 'center', alignItems: 'center' },
    heroControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
    },
    iconBtn: {
      width: 40,
      height: 40,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
    metaCard: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 4 },
    metaValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    servingsStepBtn: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    tagChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.round },
    tagChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    tabRow: { flexDirection: 'row', marginBottom: Spacing.md, borderRadius: Radius.md, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
    tabText: { fontSize: FontSize.sm },
    card: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
    ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    ingDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.md },
    ingName: { flex: 1, fontSize: FontSize.md },
    stepCard: { flexDirection: 'row', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: Radius.round,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, padding: Spacing.md },
    ctaBtn: {
      borderRadius: Radius.md,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    ctaBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  });
};
