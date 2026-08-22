//////////////////////////////////////////////////////////////////////////
//                          🔑 UsernameAuth.ts                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Connexion par pseudo, côté application.
 *
 * Supabase n'authentifie que par e-mail : la traduction pseudo → e-mail se
 * fait dans la fonction Edge `username-auth`, qui ne renvoie jamais l'adresse
 * elle-même, seulement une session quand le mot de passe est bon. Ce fichier
 * n'est que le guichet : il appelle la fonction, puis installe la session
 * dans le client Supabase avec `setSession`, ce qui déclenche exactement le
 * même parcours qu'une connexion classique (événement SIGNED_IN, contexte
 * d'authentification mis à jour, rafraîchissement automatique du jeton).
 *
 * SOMMAIRE
 * Chap 1. Appel de la fonction Edge
 * Chap 2. Connexion
 * Chap 3. Disponibilité d'un pseudo
 */

import { getSupabaseClient } from '@/template';

const FUNCTION_NAME = 'username-auth';

/////////////////////////////// Chap 1. Appel ///////////////////////////////

interface EdgeResult<T> {
  data: T | null;
  error: string | null;
}

/*
 * `functions.invoke` signale les réponses 4xx/5xx par une erreur dont le corps
 * n'est lisible que via `context` — sans ce déballage, un « pseudo ou mot de
 * passe incorrect » arriverait à l'écran sous la forme « Edge Function
 * returned a non-2xx status code ».
 */
async function callEdge<T>(body: Record<string, unknown>): Promise<EdgeResult<T>> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke(FUNCTION_NAME, { body });

    if (error) {
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === 'function') {
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) return { data: null, error: payload.error };
        } catch {
          // Corps illisible : on retombe sur le message générique ci-dessous.
        }
      }
      return { data: null, error: 'Connexion au service impossible. Réessayez.' };
    }

    return { data: data as T, error: null };
  } catch {
    return { data: null, error: 'Connexion au service impossible. Réessayez.' };
  }
}

/////////////////////////////// Chap 2. Connexion ///////////////////////////////

export async function signInWithUsername(
  username: string,
  password: string,
): Promise<{ error: string | null }> {
  const { data, error } = await callEdge<{
    session: { access_token: string; refresh_token: string };
  }>({ action: 'signin', username: username.trim(), password });

  if (error) return { error };
  if (!data?.session) return { error: 'Réponse inattendue du service de connexion.' };

  const { error: sessionError } = await getSupabaseClient().auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) return { error: sessionError.message };

  return { error: null };
}

/////////////////////////////// Chap 3. Disponibilité ///////////////////////////////

/**
 * Renvoie `null` quand la question n'a pas pu être posée (réseau, service
 * indisponible). L'inscription continue alors sans blocage : c'est l'index
 * unique en base qui tranche en dernier ressort.
 */
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
  const { data, error } = await callEdge<{ available: boolean }>({
    action: 'available',
    username: username.trim(),
  });
  if (error || !data) return null;
  return data.available;
}
