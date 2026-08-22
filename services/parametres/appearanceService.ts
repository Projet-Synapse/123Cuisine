//////////////////////////////////////////////////////////////////////////
//                       🎨 AppearanceService.ts                         //
//////////////////////////////////////////////////////////////////////////

/*
 * Lecture/écriture des réglages d'apparence rattachés au compte, dans la
 * colonne `user_preferences.appearance` (migration 0005).
 *
 * Même contrat que getPreferences / savePreferences de kitchenService : tout
 * échec est silencieux et renvoie null/false, l'app continue de fonctionner
 * avec les réglages locaux (AsyncStorage) gérés par ThemeContext.
 */

import { getSupabaseClient } from '@/template';
import { ThemeSettings } from '@/contexts/ThemeContext';

/** Renvoie null si aucun réglage distant, si la colonne n'existe pas encore, ou en cas d'erreur réseau. */
export const getRemoteAppearance = async (userId: string): Promise<ThemeSettings | null> => {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('user_preferences').select('appearance').eq('id', userId).maybeSingle();

    if (error || !data) return null;

    const raw = (data as { appearance?: unknown }).appearance;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    // Une ligne existante mais jamais renseignée vaut `{}` : rien à appliquer.
    if (Object.keys(raw as object).length === 0) return null;

    return raw as ThemeSettings;
  } catch {
    return null;
  }
};

/**
 * Écrit l'apparence sans toucher aux préférences alimentaires : l'upsert ne
 * met à jour que les colonnes fournies quand la ligne existe déjà.
 */
export const saveRemoteAppearance = async (settings: ThemeSettings, userId: string): Promise<boolean> => {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('user_preferences')
      .upsert({ id: userId, appearance: settings }, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};
