-- 123Cuisine — photo de couverture pour les groupes de playlists (catalogue)
--
-- Appliquée directement sur le projet via l'outil MCP Supabase (disponible
-- depuis cette session). Conservée ici pour l'historique / une nouvelle
-- instance du projet, comme 0003_playlist_groups.sql avant elle.

alter table public.playlist_groups add column image_url text;

-- Storage : bucket dédié aux photos de groupes de playlists, même schéma que
-- le bucket "recipe-images" de 0001_init.sql (public en lecture, écriture
-- restreinte au dossier <user_id>/... du propriétaire).
insert into storage.buckets (id, name, public)
values ('playlist-group-images', 'playlist-group-images', true)
on conflict (id) do nothing;

create policy "playlist_group_images_public_read" on storage.objects
  for select using (bucket_id = 'playlist-group-images');

create policy "playlist_group_images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'playlist-group-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "playlist_group_images_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'playlist-group-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "playlist_group_images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'playlist-group-images' and (storage.foldername(name))[1] = auth.uid()::text);
