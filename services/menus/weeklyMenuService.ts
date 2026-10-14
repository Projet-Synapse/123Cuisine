//////////////////////////////////////////////////////////////////////////
//                        📅 WeeklyMenuService.ts                       //
//////////////////////////////////////////////////////////////////////////

/*
 * Couche de données des menus de la semaine (planning kanban horaire) :
 * lecture/écriture locale (AsyncStorage, mode invité) ou Supabase (connecté),
 * et gestion des membres invités à un menu partagé.
 *
 * Un menu est visible et modifiable par son propriétaire ET par les membres
 * invités (menu commun) — la suppression reste réservée au propriétaire.
 * Côté SQL, ce sont les policies de 0007_weekly_menus.sql qui portent ces
 * règles ; côté client, on ne filtre donc PAS par user_id à la lecture :
 * un membre doit voir les menus qu'on a partagés avec lui.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { generateId } from '@/services/kitchenService';

// Un plat placé dans le menu : recette choisie + créneau horaire (8h -> 20h).
// title/image sont un instantané saisi au placement : la carte du menu reste
// affichable même si la recette devient invisible pour le lecteur (recette
// privée d'un autre membre, recette supprimée) ou a depuis été renommée.
export interface WeeklyMenuEntry {
  id: string;
  recipeId: string;
  hour: number;
  title?: string;
  image?: string;
}

export interface WeeklyMenu {
  id: string;
  ownerId: string;
  name: string;
  // Lundi de la semaine couverte, au format 'YYYY-MM-DD'. Un texte plutôt
  // qu'une date : évite tout décalage de fuseau entre l'appareil et Postgres.
  weekStart: string;
  color: string;
  // Indexé par jour (0 = lundi ... 6 = dimanche). Stocké en JSONB.
  days: Record<number, WeeklyMenuEntry[]>;
  createdAt: string;
}

// Membre d'un menu partagé, enrichi de son profil pour l'écran de partage.
export interface MenuMemberInfo {
  memberId: string;
  username: string | null;
  email: string;
  createdAt: string;
}

const KEYS = {
  menus: '@kitchen_weekly_menus',
};

function fromDbMenu(row: Record<string, unknown>): WeeklyMenu {
  const rawDays = (row.days as Record<string, WeeklyMenuEntry[]>) || {};
  const days: Record<number, WeeklyMenuEntry[]> = {};
  for (const [key, entries] of Object.entries(rawDays)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 0 || day > 6 || !Array.isArray(entries)) continue;
    days[day] = entries.filter(e => e && typeof e.id === 'string' && typeof e.recipeId === 'string');
  }
  return {
    id: row.id as string,
    ownerId: row.user_id as string,
    name: row.name as string,
    weekStart: row.week_start as string,
    color: (row.color as string) || '#C0705A',
    days,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

function toDbMenu(menu: WeeklyMenu, userId: string) {
  return {
    id: menu.id,
    user_id: userId,
    name: menu.name,
    week_start: menu.weekStart,
    color: menu.color,
    days: menu.days,
    created_at: menu.createdAt,
  };
}

// ===================== Menus =====================

export const getWeeklyMenus = async (userId?: string): Promise<WeeklyMenu[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      // Pas de filtre user_id : la RLS renvoie mes menus + ceux partagés avec moi.
      const { data, error } = await sb
        .from('weekly_menus')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('[getWeeklyMenus] Supabase error:', error.message); }
      if (!error && data) return data.map(r => fromDbMenu(r as Record<string, unknown>));
    } catch (e) { console.error('[getWeeklyMenus] Exception:', e); }
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.menus);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveWeeklyMenus = async (menus: WeeklyMenu[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.menus, JSON.stringify(menus));
};

export const addWeeklyMenu = async (menu: WeeklyMenu, userId?: string): Promise<WeeklyMenu[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('weekly_menus').insert(toDbMenu(menu, userId));
      if (error) { console.error('[addWeeklyMenu] Supabase error:', error.message); throw new Error(error.message); }
      return getWeeklyMenus(userId);
    } catch (e) { console.error('[addWeeklyMenu] Exception:', e); throw e; }
  }
  const menus = await getWeeklyMenus();
  const updated = [menu, ...menus];
  await saveWeeklyMenus(updated);
  return updated;
};

// Mise à jour accessible aux membres invités aussi : pas de `.eq('user_id')`.
export const updateWeeklyMenu = async (menu: WeeklyMenu, userId?: string): Promise<WeeklyMenu[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('weekly_menus').update({
        name: menu.name,
        week_start: menu.weekStart,
        color: menu.color,
        days: menu.days,
      }).eq('id', menu.id);
      if (error) { console.error('[updateWeeklyMenu] Supabase error:', error.message); }
      return getWeeklyMenus(userId);
    } catch (e) { console.error('[updateWeeklyMenu] Exception:', e); }
  }
  const menus = await getWeeklyMenus();
  const updated = menus.map(m => m.id === menu.id ? menu : m);
  await saveWeeklyMenus(updated);
  return updated;
};

// Réservé au propriétaire (vérifié côté UI, appliqué côté SQL par la policy
// weekly_menus_delete_own).
export const deleteWeeklyMenu = async (id: string, userId?: string): Promise<WeeklyMenu[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('weekly_menus').delete().eq('id', id);
      if (error) { console.error('[deleteWeeklyMenu] Supabase error:', error.message); }
      return getWeeklyMenus(userId);
    } catch (e) { console.error('[deleteWeeklyMenu] Exception:', e); }
  }
  const menus = await getWeeklyMenus();
  const updated = menus.filter(m => m.id !== id);
  await saveWeeklyMenus(updated);
  return updated;
};

// ===================== Membres d'un menu partagé =====================
// (partage impossible en mode invité : il faut un compte pour inviter)

export const getMenuMembers = async (menuId: string): Promise<MenuMemberInfo[]> => {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('weekly_menu_members')
      .select('member_id, created_at')
      .eq('menu_id', menuId);
    if (error || !data || data.length === 0) return [];
    // user_profiles ne peut pas être embarqué par clé étrangère (member_id
    // pointe vers auth.users), donc on récupère les profils séparément.
    const ids = data.map(m => m.member_id);
    const { data: profiles } = await sb
      .from('user_profiles')
      .select('id, username, email')
      .in('id', ids);
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return data.map(m => {
      const profile = byId.get(m.member_id) as any;
      return {
        memberId: m.member_id,
        username: profile?.username ?? null,
        email: profile?.email ?? '',
        createdAt: m.created_at as string,
      };
    });
  } catch (e) {
    console.error('[getMenuMembers]', e);
    return [];
  }
};

export const inviteMember = async (menuId: string, memberId: string): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('weekly_menu_members').insert({ menu_id: menuId, member_id: memberId });
    if (error) console.error('[inviteMember] Supabase error:', error.message);
    return !error;
  } catch (e) {
    console.error('[inviteMember]', e);
    return false;
  }
};

// Le propriétaire retire qui il veut ; un membre retire son propre id pour
// quitter le menu (policy weekly_menu_members_delete_owner_or_self).
export const removeMember = async (menuId: string, memberId: string): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('weekly_menu_members')
      .delete()
      .eq('menu_id', menuId)
      .eq('member_id', memberId);
    if (error) console.error('[removeMember] Supabase error:', error.message);
    return !error;
  } catch (e) {
    console.error('[removeMember]', e);
    return false;
  }
};

// Profil réduit du propriétaire d'un menu (il n'a pas de ligne dans
// weekly_menu_members, l'écran de partage le récupère à part).
export const getMenuOwnerProfile = async (ownerId: string): Promise<{ username: string | null; email: string } | null> => {
  try {
    const sb = getSupabaseClient();
    const { data } = await sb.from('user_profiles').select('username, email').eq('id', ownerId).single();
    return data ? { username: (data.username as string) ?? null, email: data.email as string } : null;
  } catch (e) {
    console.error('[getMenuOwnerProfile]', e);
    return null;
  }
};

// ===================== Helpers de dates (semaines) =====================

// Lundi de la semaine contenant `date`, au format 'YYYY-MM-DD'.
export const getWeekStart = (date: Date): string => {
  const d = new Date(date);
  const shift = (d.getDay() + 6) % 7; // dimanche = 0 -> 6 jours de recul
  d.setDate(d.getDate() - shift);
  return toDateKey(d);
};

export const toDateKey = (d: Date): string => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// 'YYYY-MM-DD' -> Date, construite en heure locale (new Date('2026-10-13')
// seul serait interprété en UTC et pourrait retomber la veille selon le
// fuseau).
export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

// L'identifiant des plats placés dans le menu est généré côté client, comme
// partout ailleurs (colonnes uuid de Supabase). Ré-exporté pour que les
// écrans et le contexte n'aient qu'un seul import à faire.
export { generateId as generateMenuEntryId };
