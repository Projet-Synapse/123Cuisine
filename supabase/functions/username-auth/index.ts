//////////////////////////////////////////////////////////////////////////
//                               Index.ts                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Fonction Edge Supabase (Deno) : connexion par PSEUDO plutôt que par e-mail.
 *
 * Pourquoi côté serveur ? Supabase n'authentifie que par e-mail ou téléphone.
 * Se connecter avec un pseudo demande donc de retrouver l'e-mail associé — et
 * ce lien pseudo → e-mail ne doit pas être exposé à l'application : n'importe
 * qui pourrait alors moissonner les adresses de tout le monde en essayant des
 * pseudos. L'e-mail ne quitte jamais cette fonction : elle renvoie une session
 * si le mot de passe est bon, rien d'exploitable sinon.
 *
 * Deux actions :
 *   { action: 'signin',    username, password } → { session } | 401
 *   { action: 'available', username }           → { available: boolean }
 *
 * verify_jwt est volontairement DÉSACTIVÉ : par définition, on appelle ceci
 * avant d'avoir une session. L'authentification, c'est le mot de passe, vérifié
 * par Supabase lui-même — cette fonction ne fait que traduire le pseudo.
 * Elle ne révèle jamais si un pseudo existe lors d'une connexion ratée :
 * pseudo inconnu et mot de passe faux renvoient le même message.
 *
 * corsHeaders est dupliqué ici plutôt qu'importé de ../_shared/cors.ts : le
 * déploiement via l'outil MCP Supabase n'empaquette que les fichiers de ce
 * dossier. Garder les copies synchronisées si corsHeaders change.
 *
 * SOMMAIRE
 * Chap 1. Utilitaires
 * Chap 2. Action « available »
 * Chap 3. Action « signin »
 * Chap 4. Routage
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/////////////////////////////// Chap 1. Utilitaires ///////////////////////////////

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/*
 * Mêmes règles que côté application (cf. utils/username.ts) : 3 à 24 caractères,
 * lettres, chiffres, tiret et souligné. Revalidé ici parce qu'un contrôle qui
 * ne vit que dans l'interface n'est pas un contrôle.
 */
const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/;

function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return USERNAME_RE.test(trimmed) ? trimmed : null;
}

/////////////////////////////// Chap 2. Disponibilité ///////////////////////////////

async function isAvailable(admin: ReturnType<typeof createClient>, username: string) {
  // ilike sans joker = comparaison insensible à la casse, cohérente avec
  // l'index unique sur lower(username) posé par la migration 0006.
  const { data, error } = await admin
    .from('user_profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !data;
}

/////////////////////////////// Chap 3. Connexion ///////////////////////////////

async function signIn(
  admin: ReturnType<typeof createClient>,
  anon: ReturnType<typeof createClient>,
  username: string,
  password: string,
) {
  const { data: profile } = await admin
    .from('user_profiles')
    .select('email')
    .ilike('username', username)
    .maybeSingle();

  const email = (profile as { email?: string } | null)?.email;
  if (!email) {
    // Pseudo inconnu : même réponse qu'un mot de passe faux, pour ne pas
    // transformer cette fonction en détecteur de comptes existants.
    return json({ error: 'Pseudo ou mot de passe incorrect.' }, 401);
  }

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return json({ error: 'Pseudo ou mot de passe incorrect.' }, 401);
  }

  // On ne renvoie que les deux jetons : l'application les injecte avec
  // setSession, ce qui déclenche exactement le même parcours qu'une connexion
  // par e-mail (événement SIGNED_IN, rafraîchissement automatique, etc.).
  return json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}

/////////////////////////////// Chap 4. Routage ///////////////////////////////

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Fonction mal configurée côté serveur.' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête illisible.' }, 400);
  }

  const username = cleanUsername(body.username);
  if (!username) {
    return json({ error: 'Pseudo invalide : 3 à 24 caractères, lettres, chiffres, - ou _.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (body.action === 'available') {
      return json({ available: await isAvailable(admin, username) });
    }

    if (body.action === 'signin') {
      if (typeof body.password !== 'string' || body.password.length === 0) {
        return json({ error: 'Mot de passe requis.' }, 400);
      }
      const anon = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return await signIn(admin, anon, username, body.password);
    }

    return json({ error: 'Action inconnue.' }, 400);
  } catch (err) {
    console.error('[username-auth]', err);
    return json({ error: 'Service momentanément indisponible.' }, 500);
  }
});
