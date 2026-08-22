//////////////////////////////////////////////////////////////////////////
//                         👤 ProfileService.ts                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Profil utilisateur : lecture, mise à jour et photo.
 *
 * Les colonnes display_name / bio / avatar_url / avatar_color / is_public sont
 * ajoutées par la migration 0005. On lit volontairement avec `select('*')` :
 * si la migration n'a pas encore été appliquée, la lecture continue de
 * fonctionner et les champs manquants valent simplement null.
 *
 * Depuis la 1.2.6, `username` n'est plus décoratif : c'est l'identifiant de
 * connexion (cf. supabase/functions/username-auth), unique et insensible à la
 * casse. D'où le message dédié en cas de collision.
 */

import { getSupabaseClient } from '@/template';

export interface UserProfileRecord {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  isPublic: boolean;
}

export interface UserProfilePatch {
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  isPublic?: boolean;
}

type Row = Record<string, unknown>;

function toRecord(row: Row): UserProfileRecord {
  return {
    id: String(row.id ?? ''),
    email: String(row.email ?? ''),
    username: (row.username as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    bio: (row.bio as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    avatarColor: (row.avatar_color as string) ?? null,
    isPublic: row.is_public === undefined || row.is_public === null ? true : Boolean(row.is_public),
  };
}

export const getMyProfile = async (userId: string): Promise<UserProfileRecord | null> => {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('user_profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return toRecord(data as Row);
  } catch {
    return null;
  }
};

/** Renvoie null en cas de succès, sinon un message d'erreur lisible. */
export const updateMyProfile = async (userId: string, patch: UserProfilePatch): Promise<string | null> => {
  const payload: Row = {};
  if (patch.username !== undefined) payload.username = patch.username;
  if (patch.displayName !== undefined) payload.display_name = patch.displayName;
  if (patch.bio !== undefined) payload.bio = patch.bio;
  if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl;
  if (patch.avatarColor !== undefined) payload.avatar_color = patch.avatarColor;
  if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
  if (Object.keys(payload).length === 0) return null;

  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('user_profiles').update(payload).eq('id', userId);
    if (!error) return null;
    // Colonne absente = migration 0005 non appliquée : on le dit franchement
    // plutôt que d'échouer en silence.
    if (/column .* does not exist/i.test(error.message)) {
      return "Cette information n'est pas encore prise en charge par la base : la migration 0005 n'a pas été appliquée.";
    }
    // Index unique sur lower(username), posé par la migration 0006 : le pseudo
    // est un identifiant de connexion, deux personnes ne peuvent pas le partager.
    if (error.code === '23505' || /duplicate key|unique constraint/i.test(error.message)) {
      return 'Ce pseudo est déjà pris. Choisis-en un autre.';
    }
    return error.message;
  } catch {
    return 'Connexion impossible. Réessaie dans un instant.';
  }
};

/**
 * Envoie la photo de profil dans le bucket `avatars` (migration 0005).
 * Même logique que uploadRecipeImage / uploadPlaylistGroupImage.
 */
export const uploadAvatarImage = async (localUri: string, userId: string): Promise<string | null> => {
  try {
    const sb = getSupabaseClient();
    const ext = localUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const fileName = `${userId}/avatar_${Date.now()}.${ext}`;
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const response = await fetch(localUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { error } = await sb.storage.from('avatars').upload(fileName, arrayBuffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) return null;

    const { data } = sb.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
};
