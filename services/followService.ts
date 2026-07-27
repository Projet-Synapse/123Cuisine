// Powered by OnSpace.AI
import { getSupabaseClient } from '@/template';

export interface UserProfile {
  id: string;
  username: string | null;
  email: string;
  isFollowing: boolean;
  publicRecipeCount: number;
}

export const searchUsers = async (query: string, currentUserId?: string): Promise<UserProfile[]> => {
  if (!query.trim() || query.length < 2) return [];
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('user_profiles')
      .select('id, username, email')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20);

    if (error || !data) return [];
    const filtered = currentUserId ? data.filter((u: any) => u.id !== currentUserId) : data;
    if (filtered.length === 0) return [];

    const userIds = filtered.map((u: any) => u.id);
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

    return filtered.map((u: any) => ({
      id: u.id,
      username: u.username ?? null,
      email: u.email,
      isFollowing: followingSet.has(u.id),
      publicRecipeCount: countMap[u.id] ?? 0,
    }));
  } catch (e) {
    console.error('[searchUsers]', e);
    return [];
  }
};

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
