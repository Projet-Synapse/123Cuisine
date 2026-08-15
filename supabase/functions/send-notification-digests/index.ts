//////////////////////////////////////////////////////////////////////////
//                               Index.ts                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Fonction Edge Supabase (Deno) déclenchée par cron (.github/workflows/notification-digests.yml) : envoie par email les digests dus (activité des personnes suivies, recommandations de plats) selon la récurrence choisie par chaque utilisateur dans notification_preferences. "weekly_menus" n'a pas encore de contenu (fonctionnalité pas construite) et est ignorée pour l'instant.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Category = 'activity' | 'recommendations' | 'weekly_menus';
type Recurrence = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PreferenceRow {
  user_id: string;
  category: Category;
  recurrence: Recurrence;
  last_sent_at: string | null;
}

const RECURRENCE_MS: Record<Recurrence, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

const RECOMMENDATION_SUGGESTIONS = [
  { title: '🍽️ Idée repas du jour', body: 'Avez-vous pensé à cuisiner une ratatouille ce soir ?' },
  { title: '👨‍🍳 Inspiration cuisine', body: 'Découvrez une nouvelle recette adaptée à vos préférences !' },
  { title: '🛒 Préparez vos courses', body: "N'oubliez pas de préparer votre liste de courses !" },
  { title: '❤️ Recette coup de cœur', body: "Revisitez l'une de vos recettes favorites ce soir." },
  { title: '🌿 Cuisine saine', body: 'Essayez une recette végétarienne aujourd\'hui pour varier !' },
];

function isDue(row: PreferenceRow, now: Date): boolean {
  const intervalMs = RECURRENCE_MS[row.recurrence];
  if (!row.last_sent_at) return true;
  const lastSent = new Date(row.last_sent_at).getTime();
  return now.getTime() - lastSent >= intervalMs;
}

// Borne basse pour aller chercher le contenu "nouveau depuis la dernière fois" :
// à la première exécution (last_sent_at absent), on ne remonte qu'un seul
// intervalle en arrière plutôt que tout l'historique.
function sinceDate(row: PreferenceRow, now: Date): Date {
  if (row.last_sent_at) return new Date(row.last_sent_at);
  return new Date(now.getTime() - RECURRENCE_MS[row.recurrence]);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('[send-notification-digests] RESEND_API_KEY absent — email non envoyé (préférence non marquée comme traitée, sera retentée).');
    return false;
  }
  const from = Deno.env.get('RESEND_FROM_EMAIL') || '123Cuisine <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[send-notification-digests] Resend error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[send-notification-digests] Resend exception:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase service credentials missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Clé service_role : contourne volontairement la RLS de
  // notification_preferences pour pouvoir traiter les réglages de tous les
  // utilisateurs — cette fonction ne tourne jamais dans un contexte
  // utilisateur (cron uniquement, jamais appelée depuis l'app).
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const results = { sent: 0, skipped: 0, errors: 0 };

  try {
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, category, recurrence, last_sent_at')
      .eq('enabled', true);

    if (prefsError) throw prefsError;

    for (const row of (prefs ?? []) as PreferenceRow[]) {
      if (row.category === 'weekly_menus') {
        // Pas encore de contenu pour cette catégorie (fonctionnalité pas
        // construite) : on ne fait rien et on ne marque rien comme envoyé.
        continue;
      }
      if (!isDue(row, now)) {
        results.skipped++;
        continue;
      }

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, username')
          .eq('id', row.user_id)
          .single();
        if (!profile?.email) {
          results.skipped++;
          continue;
        }

        let subject = '';
        let html = '';
        let hasContent = false;

        if (row.category === 'activity') {
          const { data: follows } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', row.user_id);
          const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);

          if (followingIds.length > 0) {
            const { data: newRecipes } = await supabase
              .from('recipes')
              .select('title, user_id, created_at')
              .in('user_id', followingIds)
              .eq('is_public', true)
              .gte('created_at', sinceDate(row, now).toISOString())
              .order('created_at', { ascending: false })
              .limit(20);

            if (newRecipes && newRecipes.length > 0) {
              hasContent = true;
              subject = `${newRecipes.length} nouvelle${newRecipes.length > 1 ? 's' : ''} recette${newRecipes.length > 1 ? 's' : ''} chez les personnes que vous suivez`;
              html = `<h2>Activité récente</h2><ul>${newRecipes
                .map((r: { title: string }) => `<li>${r.title}</li>`)
                .join('')}</ul>`;
            }
          }
        } else if (row.category === 'recommendations') {
          const { data: favorites } = await supabase
            .from('recipes')
            .select('title')
            .eq('user_id', row.user_id)
            .eq('is_favorite', true)
            .limit(20);

          let title: string;
          let body: string;
          if (favorites && favorites.length > 0) {
            const pick = favorites[Math.floor(Math.random() * favorites.length)] as { title: string };
            title = 'Recette coup de cœur';
            body = `Que diriez-vous de "${pick.title}" ce soir ?`;
          } else {
            const pick = RECOMMENDATION_SUGGESTIONS[Math.floor(Math.random() * RECOMMENDATION_SUGGESTIONS.length)];
            title = pick.title;
            body = pick.body;
          }
          hasContent = true;
          subject = title;
          html = `<p>${body}</p>`;
        }

        if (!hasContent) {
          // Rien de neuf à envoyer : on marque quand même comme traité pour
          // que le prochain envoi reparte du bon horodatage.
          await supabase
            .from('notification_preferences')
            .update({ last_sent_at: now.toISOString() })
            .eq('user_id', row.user_id)
            .eq('category', row.category);
          results.skipped++;
          continue;
        }

        const sent = await sendEmail(profile.email, subject, html);
        if (sent) {
          await supabase
            .from('notification_preferences')
            .update({ last_sent_at: now.toISOString() })
            .eq('user_id', row.user_id)
            .eq('category', row.category);
          results.sent++;
        } else {
          results.skipped++;
        }
      } catch (rowError) {
        console.error('[send-notification-digests] row error:', row.user_id, row.category, rowError);
        results.errors++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-notification-digests] fatal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
