//////////////////////////////////////////////////////////////////////////
//                            👤 Username.ts                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Règles du pseudo, partagées par l'inscription et la connexion.
 *
 * Le même contrôle existe côté serveur (supabase/functions/username-auth) :
 * celui d'ici sert à répondre tout de suite, pas à protéger quoi que ce soit.
 * Garder les deux en phase si les règles changent.
 */

/** 3 à 24 caractères : lettres, chiffres, tiret, souligné. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

export const USERNAME_RULE_TEXT = '3 à 24 caractères : lettres, chiffres, tiret ou souligné.';

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

/**
 * Distingue un pseudo d'une adresse e-mail.
 *
 * L'écran de connexion accepte les deux : le champ demande un pseudo, mais
 * quelqu'un qui tape son e-mail par habitude — ou dont le compte est plus
 * ancien que les pseudos — doit pouvoir entrer malgré tout.
 */
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}
