//////////////////////////////////////////////////////////////////////////
//                       📅 WeeklyMenuContext.tsx                       //
//////////////////////////////////////////////////////////////////////////

/*
 * Contexte central des menus de la semaine : chargement, écritures
 * optimistes et gestion des plats placés sur les créneaux horaires.
 * Même fonctionnement que KitchenContext : bascule local (invité) /
 * Supabase (connecté), modification possible aussi par les membres invités
 * d'un menu partagé (côté SQL : policies de 0007_weekly_menus.sql).
 */

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  WeeklyMenu,
  getWeeklyMenus,
  addWeeklyMenu,
  updateWeeklyMenu,
  deleteWeeklyMenu,
} from '@/services/menus/weeklyMenuService';
import { generateId } from '@/services/kitchenService';
import { useAuth, useAlert } from '@/template';

export interface WeeklyMenuContextType {
  menus: WeeklyMenu[];
  loading: boolean;
  refreshMenus: () => Promise<void>;
  createMenu: (weekStart: string, name: string) => Promise<WeeklyMenu>;
  deleteMenu: (id: string) => Promise<void>;
  addDish: (menuId: string, day: number, hour: number, entry: { recipeId: string; title?: string; image?: string }) => Promise<void>;
  removeDish: (menuId: string, day: number, entryId: string) => Promise<void>;
  moveDish: (menuId: string, entryId: string, toDay: number, toHour: number) => Promise<void>;
}

export const WeeklyMenuContext = createContext<WeeklyMenuContextType | undefined>(undefined);

export function WeeklyMenuProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const userId = user?.id;

  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [loading, setLoading] = useState(true);

  // Même logique que dans KitchenContext : écritures optimistes, et en cas
  // d'échec de l'envoi serveur on le dit au lieu de perdre la modification
  // en silence à la prochaine synchronisation.
  const notifySaveError = useCallback(() => {
    showAlert(
      'Sauvegarde impossible',
      "Cette modification est visible ici, mais n'a pas pu être enregistrée sur le serveur. Vérifiez votre connexion, puis réessayez pour ne pas la perdre.",
    );
  }, [showAlert]);

  // `silent` évite de repasser loading à true au tirer-pour-rafraîchir
  // (cf. commentaire de KitchenContext.loadData).
  const loadData = useCallback(async (uid?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const list = await getWeeklyMenus(uid);
    setMenus(list);
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadData(userId);
  }, [userId, loadData]);

  const refreshMenus = useCallback(async () => {
    await loadData(userId, { silent: true });
  }, [userId, loadData]);

  // Applique une transformation au menu (ajout/retrait/déplacement d'un plat)
  // puis persiste : d'abord l'état local (réponse immédiate à l'écran),
  // ensuite le serveur — ou le stockage local en mode invité.
  const applyMenuUpdate = useCallback(async (menuId: string, transform: (m: WeeklyMenu) => WeeklyMenu) => {
    let updated: WeeklyMenu | undefined;
    setMenus(prev =>
      prev.map(m => {
        if (m.id !== menuId) return m;
        updated = transform(m);
        return updated;
      }),
    );
    if (updated) {
      if (userId) {
        try {
          const sb = (await import('@/template')).getSupabaseClient();
          const { error } = await sb.from('weekly_menus').update({
            name: updated.name,
            week_start: updated.weekStart,
            color: updated.color,
            days: updated.days,
          }).eq('id', updated.id);
          if (error) { console.error('[updateWeeklyMenu] Supabase:', error.message); notifySaveError(); }
        } catch (e) { console.error('[updateWeeklyMenu]', e); notifySaveError(); }
      } else {
        await updateWeeklyMenu(updated);
      }
    }
  }, [userId, notifySaveError]);

  const handleCreateMenu = useCallback(async (weekStart: string, name: string) => {
    const menu: WeeklyMenu = {
      id: generateId(),
      ownerId: userId ?? '',
      name,
      weekStart,
      color: '#C0705A',
      days: {},
      createdAt: new Date().toISOString(),
    };
    setMenus(prev => [menu, ...prev]);
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('weekly_menus').insert({
          id: menu.id,
          user_id: userId,
          name: menu.name,
          week_start: menu.weekStart,
          color: menu.color,
          days: menu.days,
          created_at: menu.createdAt,
        });
        if (error) { console.error('[addWeeklyMenu] Supabase:', error.message); notifySaveError(); }
      } catch (e) { console.error('[addWeeklyMenu]', e); notifySaveError(); }
    } else {
      await addWeeklyMenu(menu);
    }
    return menu;
  }, [userId, notifySaveError]);

  const handleDeleteMenu = useCallback(async (id: string) => {
    setMenus(prev => prev.filter(m => m.id !== id));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('weekly_menus').delete().eq('id', id);
        if (error) { console.error('[deleteWeeklyMenu] Supabase:', error.message); notifySaveError(); }
      } catch (e) { console.error('[deleteWeeklyMenu]', e); notifySaveError(); }
    } else {
      await deleteWeeklyMenu(id);
    }
  }, [userId, notifySaveError]);

  const handleAddDish = useCallback(
    async (menuId: string, day: number, hour: number, entry: { recipeId: string; title?: string; image?: string }) => {
      await applyMenuUpdate(menuId, m => ({
        ...m,
        days: {
          ...m.days,
          [day]: [...(m.days[day] ?? []), { id: generateId(), hour, ...entry }],
        },
      }));
    },
    [applyMenuUpdate],
  );

  const handleRemoveDish = useCallback(async (menuId: string, day: number, entryId: string) => {
    await applyMenuUpdate(menuId, m => ({
      ...m,
      days: {
        ...m.days,
        [day]: (m.days[day] ?? []).filter(e => e.id !== entryId),
      },
    }));
  }, [applyMenuUpdate]);

  // Déplace un plat vers un autre créneau (autre jour et/ou autre heure) :
  // retrait de sa liste d'origine, ajout dans celle de destination.
  const handleMoveDish = useCallback(async (menuId: string, entryId: string, toDay: number, toHour: number) => {
    await applyMenuUpdate(menuId, m => {
      const moved = Object.values(m.days)
        .flat()
        .find(e => e.id === entryId);
      if (!moved) return m;
      const days: WeeklyMenu['days'] = {};
      for (let d = 0; d <= 6; d++) {
        const filtered = (m.days[d] ?? []).filter(e => e.id !== entryId);
        if (filtered.length > 0) days[d] = filtered;
      }
      return {
        ...m,
        days: { ...days, [toDay]: [...(days[toDay] ?? []), { ...moved, hour: toHour }] },
      };
    });
  }, [applyMenuUpdate]);

  return (
    <WeeklyMenuContext.Provider value={{
      menus,
      loading,
      refreshMenus,
      createMenu: handleCreateMenu,
      deleteMenu: handleDeleteMenu,
      addDish: handleAddDish,
      removeDish: handleRemoveDish,
      moveDish: handleMoveDish,
    }}>
      {children}
    </WeeklyMenuContext.Provider>
  );
}
