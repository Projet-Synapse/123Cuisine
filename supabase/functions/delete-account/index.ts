//////////////////////////////////////////////////////////////////////////
//                               Index.ts                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Fonction Edge Supabase (Deno) : suppression définitive du compte de
 * l'utilisateur qui appelle.
 *
 * Pourquoi côté serveur ? L'API client de Supabase ne peut pas supprimer un
 * utilisateur de `auth.users` : cela demande la clé service role, qui ne doit
 * jamais se retrouver dans une app distribuée. La fonction vérifie donc le
 * jeton de l'appelant, puis supprime SON PROPRE compte — jamais celui d'un
 * autre, l'identifiant n'est pas lu depuis le corps de la requête.
 *
 * Les données liées (recettes, listes, categories, dossiers, préférences,
 * abonnements, notes) disparaissent d'elles-mêmes : toutes leurs tables
 * déclarent `references auth.users(id) on delete cascade` (cf. 0001_init.sql).
 *
 * corsHeaders est dupliqué ici plutôt qu'importé de ../_shared/cors.ts : le
 * déploiement via l'outil MCP Supabase n'empaquette que les fichiers de ce
 * dossier. Garder les deux copies synchronisées si corsHeaders change.
 *
 * Déploiement : supabase functions deploy delete-account
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Fonction mal configurée côté serveur.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  // 1. Identifier l'appelant à partir de SON jeton — jamais d'un identifiant
  //    fourni dans la requête, sinon n'importe qui pourrait supprimer autrui.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json({ error: 'Session invalide ou expirée.' }, 401);
  }

  // 2. Supprimer avec les droits service role.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Les fichiers de stockage ne sont pas couverts par le cascade SQL : on les
  // retire explicitement, dossier par utilisateur (cf. les policies de
  // 0001_init.sql, 0004 et 0005).
  for (const bucket of ['recipe-images', 'playlist-group-images', 'avatars']) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(user.id);
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map(f => `${user.id}/${f.name}`));
      }
    } catch {
      // Un bucket absent ou un fichier déjà supprimé ne doit pas empêcher la
      // suppression du compte lui-même.
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return json({ error: `Suppression impossible : ${deleteError.message}` }, 500);
  }

  return json({ ok: true });
});
