//////////////////////////////////////////////////////////////////////////
//                       🛒 MenuToShoppingList.ts                       //
//////////////////////////////////////////////////////////////////////////

/*
 * Transformation « menu de la semaine → liste de courses » (l'arme de Jow) :
 * les ingrédients de TOUS les plats de la semaine sont consolidés en une
 * seule liste — doublons fusionnés (3 plats à l'ail = 1 ligne « ail »),
 * quantités recalculées pour le foyer (préférences.defaultServings), triées
 * par rayon. Le budget estimé s'appuie sur priceService.
 *
 * Choix assumé : pas d'inventaire de frigo (il dérive toujours, cf. Plan to
 * Eat) — les cases « je l'ai déjà » de la liste générée font le travail.
 */

import { generateId, ListItem, Recipe } from '@/services/kitchenService';
import { WeeklyMenu } from '@/services/menus/weeklyMenuService';
import { formatQuantity, parseLeadingQuantity } from '@/utils/servings';
import { detectCategory, getItemEstimatedPrice } from '@/services/courses/priceService';

export interface MenuToShoppingResult {
  items: ListItem[];
  // Nombre de plats réellement pris en compte (recette lue avec ingrédients)
  dishCount: number;
  // Titres des plats dont la recette n'a pas pu être lue (fiche supprimée ou
  // inaccessible) — le plat reste au menu mais n'alimente pas la liste.
  unresolvedTitles: string[];
}

// Minuscules, sans accents, espaces réduits : « Tomates Cerises » et
// « tomates cerises » doivent fusionner en une seule ligne de courses.
const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface Aggregate {
  name: string; // libellé d'origine (casse préservée, première occurrence)
  unit: string;
  category: string;
  value: number; // somme des quantités numériques (0 si non numériques)
  rest: string; // suffixe non numérique de la quantité ("branches"...)
  rawText: string | null; // quantité non numérique ("une pincée")
}

export function buildShoppingListFromMenu(
  menu: WeeklyMenu,
  resolveRecipe: (recipeId: string) => Recipe | null | undefined,
  defaultServings: number,
): MenuToShoppingResult {
  const aggregates = new Map<string, Aggregate>();
  const unresolvedTitles: string[] = [];
  let dishCount = 0;

  for (let day = 0; day <= 6; day++) {
    for (const entry of menu.days[day] ?? []) {
      const recipe = resolveRecipe(entry.recipeId);
      if (!recipe) {
        unresolvedTitles.push(entry.title ?? 'Plat sans fiche');
        continue;
      }
      dishCount++;
      // Le foyer mange à N : chaque recette est ramenée à l'échelle du
      // compte (recette pour 4, foyer de 2 -> moitié des quantités).
      const factor = recipe.servings > 0 ? defaultServings / recipe.servings : 1;

      for (const ing of recipe.ingredients) {
        const unit = (ing.unit ?? '').trim();
        const normUnit = unit.toLowerCase();
        const normName = normalizeName(ing.name);
        const parsed = parseLeadingQuantity(ing.quantity ?? '');
        const category = ing.category || detectCategory(ing.name);

        let key: string;
        if (parsed) {
          key = `${normName}|${normUnit}|${normalizeName(parsed.rest)}`;
        } else {
          // Quantité non numérique ("une pincée", "quelques brins") : on
          // fusionne uniquement les libellés strictement identiques.
          const rawText = (ing.quantity ?? '').trim().toLowerCase();
          key = `${normName}|${normUnit}|txt|${rawText}`;
        }

        const existing = aggregates.get(key);
        if (!existing) {
          aggregates.set(key, {
            name: ing.name,
            unit,
            category,
            value: parsed ? parsed.value * factor : 0,
            rest: parsed ? parsed.rest : '',
            rawText: parsed ? null : (ing.quantity ?? '').trim(),
          });
          continue;
        }
        if (parsed) existing.value += parsed.value * factor;
      }
    }
  }

  const items: ListItem[] = [...aggregates.values()].map(a => ({
    id: generateId(),
    name: a.name,
    quantity: a.rawText ?? (a.rest ? `${formatQuantity(a.value)} ${a.rest}` : formatQuantity(a.value)),
    unit: a.unit || 'unité(s)',
    category: a.category || 'Autre',
    checked: false,
  }));

  // Rayons groupés : les articles d'une même catégorie se suivent.
  items.sort((a, b) => a.category.localeCompare(b.category, 'fr'));

  return { items, dishCount, unresolvedTitles };
}

// Estimation du panier (côté prix le plus bas parmi les enseignes suivies).
export function estimateBasketTotal(
  items: { category: string; quantity: string; unit: string; checked: boolean }[],
  supermarketId: string,
): number {
  return (
    Math.round(
      items.filter(i => !i.checked).reduce((sum, i) => sum + getItemEstimatedPrice(i.category, i.quantity, i.unit, supermarketId), 0) *
        100,
    ) / 100
  );
}
