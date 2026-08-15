-- 123Cuisine — groupes de playlists (imbriqués, multi-appartenance)
--
-- Appliquée directement sur le projet via l'outil MCP Supabase (disponible
-- depuis cette session). Conservée ici pour l'historique / une nouvelle
-- instance du projet — pas besoin de la recoller à la main si vous
-- retrouvez ce message après coup, elle est déjà en place.

create table public.playlist_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.playlist_groups(id) on delete cascade,
  name text not null,
  color text not null default '#C0705A',
  created_at timestamptz not null default now()
);

-- Appartenance multi-groupe des playlists : tableau d'ids de groupes,
-- cohérent avec le style déjà utilisé ailleurs dans ce projet (recipe_ids,
-- items...) plutôt qu'une table de jointure.
alter table public.recipe_playlists add column group_ids jsonb not null default '[]';

grant select, insert, update, delete on public.playlist_groups to authenticated;

alter table public.playlist_groups enable row level security;

-- Strictement privé. `on delete cascade` sur parent_id supprime
-- automatiquement toute la sous-arborescence quand un groupe parent est
-- supprimé — mais ne nettoie pas les group_ids des playlists qui
-- référençaient ces groupes (tableau JSONB, pas une clé étrangère) : c'est
-- fait côté app, cf. deletePlaylistGroup dans services/kitchenService.ts.
create policy "playlist_groups_all_own" on public.playlist_groups
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
