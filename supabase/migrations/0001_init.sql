-- MaCuisine — schéma initial complet, reconstitué depuis le code de l'app
-- (aucune migration n'existait avant : ce projet remplace le backend géré par OnSpace)
--
-- À exécuter une seule fois, en entier, dans le SQL Editor de votre projet Supabase
-- (https://supabase.com/dashboard/project/_/sql/new).

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text not null
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text default '',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  tags jsonb not null default '[]',
  duration integer not null default 30,
  servings integer not null default 4,
  difficulty text not null default 'Facile' check (difficulty in ('Facile', 'Moyen', 'Difficile')),
  image_url text,
  is_favorite boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  supermarket_id text,
  color text not null default '#666666',
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  liked_ingredients jsonb not null default '[]',
  disliked_ingredients jsonb not null default '[]',
  dietary_tags jsonb not null default '[]',
  allergies jsonb not null default '[]',
  default_servings integer not null default 4,
  updated_at timestamptz not null default now()
);

create table public.recipe_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  recipe_ids jsonb not null default '[]',
  cover_color text not null default '#C0705A',
  created_at timestamptz not null default now()
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.recipe_ratings (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rating numeric not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  primary key (recipe_id, rater_id)
);

-- ============================================================
-- Trigger : création automatique du profil à l'inscription
-- (l'app s'attend à ce que ceci se fasse côté serveur, cf.
-- template/auth/supabase/service.ts qui log un avertissement sinon)
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, username)
  values (new.id, new.email, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Grants (nécessaires en plus de RLS : sans eux, Postgres refuse
-- l'accès aux tables avant même que les policies RLS s'appliquent)
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select on public.user_profiles to anon;
grant select, update on public.user_profiles to authenticated;

grant select on public.recipes to anon;
grant select, insert, update, delete on public.recipes to authenticated;

grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.recipe_playlists to authenticated;

grant select on public.follows to anon;
grant select, insert, delete on public.follows to authenticated;

grant select on public.recipe_ratings to anon;
grant select, insert, update on public.recipe_ratings to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.user_preferences enable row level security;
alter table public.recipe_playlists enable row level security;
alter table public.follows enable row level security;
alter table public.recipe_ratings enable row level security;

-- user_profiles : lisible par tous (recherche d'utilisateurs, auteur des recettes
-- publiques), modifiable seulement par soi-même (pseudo)
create policy "user_profiles_select_all" on public.user_profiles
  for select to anon, authenticated using (true);
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- recipes : ses propres recettes + toutes les recettes publiques des autres
create policy "recipes_select_own_or_public" on public.recipes
  for select to anon, authenticated using (is_public = true or user_id = auth.uid());
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (user_id = auth.uid());
create policy "recipes_update_own" on public.recipes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (user_id = auth.uid());

-- shopping_lists : strictement privé
create policy "shopping_lists_all_own" on public.shopping_lists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_preferences : strictement privé
create policy "user_preferences_all_own" on public.user_preferences
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- recipe_playlists : strictement privé
create policy "recipe_playlists_all_own" on public.recipe_playlists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows : graphe social lisible par tous, modifiable seulement par le follower lui-même
create policy "follows_select_all" on public.follows
  for select to anon, authenticated using (true);
create policy "follows_insert_own" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy "follows_delete_own" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- recipe_ratings : notes lisibles par tous (stats), modifiables seulement par leur auteur
create policy "recipe_ratings_select_all" on public.recipe_ratings
  for select to anon, authenticated using (true);
create policy "recipe_ratings_upsert_own" on public.recipe_ratings
  for insert to authenticated with check (rater_id = auth.uid());
create policy "recipe_ratings_update_own" on public.recipe_ratings
  for update to authenticated using (rater_id = auth.uid()) with check (rater_id = auth.uid());

-- ============================================================
-- Storage : bucket des images de recettes
-- ============================================================

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "recipe_images_public_read" on storage.objects
  for select using (bucket_id = 'recipe-images');

create policy "recipe_images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_images_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
