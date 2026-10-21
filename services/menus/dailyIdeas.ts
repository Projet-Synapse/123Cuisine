//////////////////////////////////////////////////////////////////////////
//                          💡 DailyIdeas.ts                            //
//////////////////////////////////////////////////////////////////////////

/*
 * « Idées du jour » — le rituel d'inspiration à la KptnCook : trois recettes
 * qui changent chaque jour, choisies par un moteur à règles (aucune IA, donc
 * gratuit et instantané) :
 *   - exclusions DURES : allergies et ingrédients détestés, plats déjà
 *     planifiés dans la semaine en cours ;
 *   - score : ingrédients aimés (+2), régime suivi (+1), recette rapide
 *     (<= 30 min, +1), favorite (+1) ;
 *   - variation quotidienne déterministe : un petit caractère du jour
 *     (hash date + recette) fait tourner le trio sans jamais être aléatoire
 *     à l'intérieur d'une même journée (pas de clignotement à chaque rendu).
 */

import { Preferences, PublicRecipe, Recipe } from '@/services/kitchenService';

const hashString = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const containsIngredient = (recipe: Recipe, needles: string[]): boolean => {
  const names = recipe.ingredients.map(i => i.name.toLowerCase());
  return needles.some(n => names.some(name => name.includes(n.toLowerCase())));
};

export interface DailyIdeasInput {
  recipes: Recipe[];
  publicRecipes: PublicRecipe[];
  preferences: Preferences;
  // Recettes déjà placées dans le menu de la semaine en cours.
  plannedRecipeIds: string[];
  // 'YYYY-MM-DD' : la même journée donne toujours les mêmes idées.
  dateKey: string;
  count?: number;
}

export function getDailyIdeas({
  recipes,
  publicRecipes,
  preferences,
  plannedRecipeIds,
  dateKey,
  count = 3,
}: DailyIdeasInput): Recipe[] {
  const planned = new Set(plannedRecipeIds);
  const pool: Recipe[] = [
    ...recipes,
    // La communauté nourrit l'inspiration quand le compte personnel est
    // encore maigre — lesPublicRecipe étendent Recipe.
    ...publicRecipes,
  ];

  const scored = pool
    .filter(recipe => !planned.has(recipe.id))
    .filter(recipe => !containsIngredient(recipe, preferences.allergies))
    .filter(recipe => !containsIngredient(recipe, preferences.dislikedIngredients))
    .map(recipe => {
      const names = recipe.ingredients.map(i => i.name.toLowerCase());
      const tagLower = recipe.tags.map(t => t.toLowerCase());
      let score = hashString(`${dateKey}:${recipe.id}`) % 7;
      for (const liked of preferences.likedIngredients) {
        if (names.some(n => n.includes(liked.toLowerCase()))) score += 2;
      }
      for (const dietTag of preferences.dietaryTags) {
        if (tagLower.some(t => t.includes(dietTag.toLowerCase()))) score += 1;
      }
      if (recipe.duration <= 30) score += 1;
      if (recipe.isFavorite) score += 1;
      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(s => s.recipe);
}
