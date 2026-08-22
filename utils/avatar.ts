//////////////////////////////////////////////////////////////////////////
//                             👤 Avatar.ts                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Avatar de repli quand l'utilisateur n'a pas de photo : initiales sur une
 * pastille dont la couleur est dérivée de son identifiant (donc stable d'un
 * appareil à l'autre, et identique pour tout le monde).
 *
 * Mutualisé ici parce que la même logique existait en double dans l'écran
 * de profil public et dans l'espace personnel.
 */

import { ACCENT_SWATCHES } from '@/constants/theme';

/** Hash déterministe -> une des couleurs de la palette d'accents. */
export function getAvatarColor(id: string, override?: string | null): string {
  if (override) return override;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return ACCENT_SWATCHES[Math.abs(h) % ACCENT_SWATCHES.length];
}

/** 1 à 2 initiales tirées du pseudo, du nom affiché ou de l'e-mail. */
export function getInitials(
  source?: { displayName?: string | null; username?: string | null; email?: string | null } | null,
): string {
  if (!source) return '?';
  const name = source.displayName || source.username || source.email;
  if (!name) return '?';
  const initials = name
    .split(/[@._\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
  return initials || '?';
}

/**
 * Ratio de hauteur pseudo-aléatoire mais stable, pour donner au mur de
 * créations son irrégularité « Pinterest » sans avoir à mesurer les images.
 */
export function getTileRatio(id: string, ratios: number[] = [1, 1.25, 0.8, 1.45, 1.05]): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return ratios[Math.abs(h) % ratios.length];
}
