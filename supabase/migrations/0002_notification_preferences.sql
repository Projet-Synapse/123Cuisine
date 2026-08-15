-- 123Cuisine — préférences de notifications par email (activité des personnes
-- suivies, recommandations de plats, menus de la semaine à venir)
--
-- À exécuter une seule fois, en entier, dans le SQL Editor de votre projet Supabase
-- (https://supabase.com/dashboard/project/_/sql/new), après 0001_init.sql.

-- ============================================================
-- Table
-- ============================================================

-- Une ligne par (utilisateur, catégorie) : chaque catégorie a son propre
-- interrupteur, sa propre récurrence, et son propre horodatage de dernier
-- envoi (utilisé par la fonction Edge send-notification-digests pour savoir
-- qui est "dû" et ne récupérer que le contenu apparu depuis la dernière fois).
create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('activity', 'recommendations', 'weekly_menus')),
  enabled boolean not null default false,
  recurrence text not null default 'weekly' check (recurrence in ('hourly', 'daily', 'weekly', 'monthly', 'yearly')),
  last_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- ============================================================
-- Grants
-- ============================================================

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.notification_preferences enable row level security;

-- Strictement privé : chacun ne voit/modifie que ses propres réglages.
-- La fonction Edge send-notification-digests contourne cette policy via la
-- clé service_role (fournie automatiquement dans l'environnement des
-- fonctions Edge Supabase) pour pouvoir lire les réglages de tout le monde.
create policy "notification_preferences_all_own" on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
