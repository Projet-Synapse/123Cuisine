-- 123Cuisine — apparence personnalisée + profil enrichi
--
-- Appliquée directement sur le projet via l'outil MCP Supabase, comme
-- 0003_playlist_groups.sql. Conservée ici pour l'historique / une nouvelle
-- instance du projet.

-- ============================================================
-- 1. Apparence de l'interface, rattachée au compte
-- ============================================================
-- Réutilise user_preferences plutôt qu'une nouvelle table : elle est déjà en
-- 1:1 sur auth.users, déjà couverte par la policy "user_preferences_all_own"
-- et par les grants. Le JSON contient ThemeSettings (cf. contexts/ThemeContext.tsx),
-- dont un champ updated_at qui arbitre la synchronisation multi-appareils.
alter table public.user_preferences
  add column if not exists appearance jsonb not null default '{}';

-- ============================================================
-- 2. Profil enrichi
-- ============================================================
alter table public.user_profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists avatar_color text,
  add column if not exists is_public boolean not null default true;

-- NOTE : on ne touche PAS à la policy "user_profiles_select_all". Le feed
-- social et le nom d'auteur des recettes publiques en dépendent. `is_public`
-- ne masque que le *contenu* de la page profil (mur de créations, abonnés) —
-- c'est une confidentialité d'affichage, pas une garantie côté base.

-- ============================================================
-- 3. Bucket des photos de profil
-- ============================================================
-- Mêmes règles que recipe-images / playlist-group-images : chacun n'écrit que
-- dans le dossier portant son propre uid.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
