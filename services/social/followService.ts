//////////////////////////////////////////////////////////////////////////
//                          👥 FollowService.ts                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Recherche d'utilisateurs, profils publics, abonnements (suivre/ne plus suivre) — la couche « sociale » entre proches et cuisiniers.
 */

import { getSupabaseClient } from '@/template';
import { Recipe } from '@/services/kitchenService';

export interface UserProfile {
  id: string;
  username: string | null;
  email: string;
  isFollowing: boolean;
  publicRecipeCount: number;
}

export interface FullUserProfile extends UserProfile {
  followerCount: number;
  followingCount: number;
}

export interface PublicUserRecipe {
  id: string;
  title: string;
  description: string;
  duration: number;
  servings: number;
  difficulty: Recipe['difficulty'];
  image?: string;
  tags: string[];
  ingredients: any[];
  steps: string[];
  createdAt: string;
}

// ── Shared helper ──────────────────────────────────────────────
async function buildUserProfiles(rawData: any[], currentUserId?: string): Promise<UserProfile[]> {
  if (!rawData || rawData.length === 0) return [];
  const sb = getSupabaseClient();
  const userIds = rawData.map((u: any) => u.id);
  const [followsRes, recipeRes] = await Promise.all([
    currentUserId
      ? sb.from('follows').select('following_id').eq('follower_id', currentUserId).in('following_id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    sb.from('recipes').select('user_id').eq('is_public', true).in('user_id', userIds),
  ]);
  const followingSet = new Set((followsRes?.data ?? []).map((f: any) => f.following_id));
  const countMap: Record<string, number> = {};
  (recipeRes.data ?? []).forEach((r: any) => {
    countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1;
  });
  return rawData.map((u: any) => ({
    id: u.id,
    username: u.username ?? null,
    email: u.email,
    isFollowing: followingSet.has(u.id),
    publicRecipeCount: countMap[u.id] ?? 0,
  }));
}

// ── Search users ───────────────────────────────────────────────
export const searchUsers = async (query: string, currentUserId?: string): Promise<UserProfile[]> => {
  if (!query.trim() || query.length < 2) return [];
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('user_profiles')
      .select('id, username, email')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(30);
    if (error || !data) return [];
    const filtered = currentUserId ? data.filter((u: any) => u.id !== currentUserId) : data;
    return buildUserProfiles(filtered, currentUserId);
  } catch (e) {
    console.error('[searchUsers]', e);
    return [];
  }
};

// ── Get all users ──────────────────────────────────────────────
export const getAllUsers = async (currentUserId?: string): Promise<UserProfile[]> => {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('user_profiles')
      .select('id, username, email')
      // nullsFirst: quelqu'un qui vient de s'inscrire et n'a pas encore
      // choisi de pseudo (username = null) se retrouvait trié tout en bas
      // (comportement par défaut de Postgres pour un ORDER BY ASC), et donc
      // hors de portée du .limit ci-dessous dès que la communauté grossit —
      // c'est ainsi qu'un compte fraîchement créé pouvait "disparaître" de
      // la liste. On les fait remonter en tête au lieu de les enterrer.
      .order('username', { ascending: true, nullsFirst: true })
      .limit(500);
    if (error || !data) return [];
    const filtered = currentUserId ? data.filter((u: any) => u.id !== currentUserId) : data;
    return buildUserProfiles(filtered, currentUserId);
  } catch (e) {
    console.error('[getAllUsers]', e);
    return [];
  }
};

// ── Get full profile details ───────────────────────────────────
export const getUserProfileDetails = async (userId: string, currentUserId?: string): Promise<FullUserProfile | null> => {
  try {
    const sb = getSupabaseClient();
    const [profileRes, followerRes, followingRes, recipeRes, followCheckRes] = await Promise.all([
      sb.from('user_profiles').select('id, username, email').eq('id', userId).single(),
      sb.from('follows').select('id', { count: 'exact' }).eq('following_id', userId),
      sb.from('follows').select('id', { count: 'exact' }).eq('follower_id', userId),
      sb.from('recipes').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_public', true),
      currentUserId
        ? sb.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!profileRes.data) return null;
    const u = profileRes.data as any;
    return {
      id: u.id,
      username: u.username ?? null,
      email: u.email,
      isFollowing: !!followCheckRes.data,
      publicRecipeCount: (recipeRes as any).count ?? 0,
      followerCount: (followerRes as any).count ?? 0,
      followingCount: (followingRes as any).count ?? 0,
    };
  } catch (e) {
    console.error('[getUserProfileDetails]', e);
    return null;
  }
};

// ── Get user's public recipes ──────────────────────────────────
export const getUserPublicRecipes = async (userId: string): Promise<PublicUserRecipe[]> => {
  try {
    const sb = getSupabaseClient();
    const { data } = await sb.from('recipes')
      .select('id, title, description, duration, servings, difficulty, image_url, tags, ingredients, steps, created_at')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (!data) return [];
    return data.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      duration: r.duration ?? 30,
      servings: r.servings ?? 4,
      difficulty: (r.difficulty as Recipe['difficulty']) ?? 'Facile',
      image: r.image_url ?? undefined,
      tags: Array.isArray(r.tags) ? r.tags : [],
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('[getUserPublicRecipes]', e);
    return [];
  }
};

// ── Follow / Unfollow ──────────────────────────────────────────
export const followUser = async (followingId: string): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('follows').insert({ following_id: followingId });
    return !error;
  } catch { return false; }
};

export const unfollowUser = async (followingId: string): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return false;
    const { error } = await sb.from('follows').delete()
      .eq('follower_id', u.user.id).eq('following_id', followingId);
    return !error;
  } catch { return false; }
};

export const getFollowedUserIds = async (userId: string): Promise<string[]> => {
  try {
    const sb = getSupabaseClient();
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', userId);
    return (data ?? []).map((f: any) => f.following_id);
  } catch { return []; }
};
