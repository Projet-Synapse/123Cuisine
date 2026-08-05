//////////////////////////////////////////////////////////////////////////
//                         👍 RatingService.ts                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Notation des recettes (1 à 5) par les utilisateurs, et statistiques agrégées par recette.
 */

import { getSupabaseClient } from '@/template';

export interface RecipeRatingStats {
  avg: number;
  count: number;
}

export const rateRecipe = async (recipeId: string, rating: number): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { error } = await sb.from('recipe_ratings').upsert(
      { recipe_id: recipeId, rater_id: user.id, rating },
      { onConflict: 'recipe_id,rater_id' }
    );
    return !error;
  } catch { return false; }
};

export const getMyRatingForRecipe = async (recipeId: string): Promise<number | null> => {
  try {
    const sb = getSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('recipe_ratings')
      .select('rating')
      .eq('recipe_id', recipeId)
      .eq('rater_id', user.id)
      .single();
    return data?.rating ?? null;
  } catch { return null; }
};

export const getRecipesRatingStats = async (recipeIds: string[]): Promise<Record<string, RecipeRatingStats>> => {
  if (recipeIds.length === 0) return {};
  try {
    const sb = getSupabaseClient();
    const { data } = await sb.from('recipe_ratings')
      .select('recipe_id, rating')
      .in('recipe_id', recipeIds);
    if (!data) return {};
    const statsMap: Record<string, { sum: number; count: number }> = {};
    data.forEach((r: any) => {
      if (!statsMap[r.recipe_id]) statsMap[r.recipe_id] = { sum: 0, count: 0 };
      statsMap[r.recipe_id].sum += r.rating;
      statsMap[r.recipe_id].count += 1;
    });
    const result: Record<string, RecipeRatingStats> = {};
    for (const [id, stats] of Object.entries(statsMap)) {
      result[id] = { avg: Math.round((stats.sum / stats.count) * 10) / 10, count: stats.count };
    }
    return result;
  } catch { return {}; }
};
