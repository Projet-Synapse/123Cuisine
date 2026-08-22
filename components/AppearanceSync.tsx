//////////////////////////////////////////////////////////////////////////
//                        🔄 AppearanceSync.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Rattache les réglages d'apparence au compte Supabase.
 *
 * Pourquoi un composant séparé plutôt que du code dans ThemeContext ?
 * ThemeProvider est monté *au-dessus* de AuthProvider (cf. app/_layout.tsx)
 * pour que l'écran de connexion soit lui aussi thémé : il ne peut donc pas
 * lire l'utilisateur. Ce composant, monté sous AuthProvider, fait le pont.
 * Il ne rend rien.
 *
 * Règles de synchronisation :
 * - au démarrage/à la connexion, on lit le distant ; il gagne s'il est plus
 *   récent que le local (`updatedAt`), sinon on pousse le local ;
 * - ensuite, tout changement local est repoussé avec 700 ms d'anti-rebond ;
 * - à la déconnexion, le réglage local est conservé tel quel.
 * Le local reste la source d'affichage : aucun clignotement au démarrage,
 * et le mode invité fonctionne sans compte.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/template';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getRemoteAppearance, saveRemoteAppearance } from '@/services/parametres/appearanceService';

const PUSH_DEBOUNCE_MS = 700;

function parseDate(iso: string | undefined): number {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? 0 : t;
}

export function AppearanceSync() {
  const { user } = useAuth();
  const { settings, applySettings, hydrated } = useAppTheme();

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // `pullStartedFor` évite de relancer la lecture à chaque rendu ; `pulledUserId`
  // n'est renseigné qu'une fois la lecture terminée, pour que l'écriture ne
  // parte jamais avant (elle écraserait le distant avec le local).
  const pullStartedFor = useRef<string | null>(null);
  const [pulledUserId, setPulledUserId] = useState<string | null>(null);
  const lastPushedJson = useRef<string | null>(null);

  // ── Lecture initiale ──
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      pullStartedFor.current = null;
      lastPushedJson.current = null;
      setPulledUserId(null);
      return;
    }
    if (pullStartedFor.current === user.id) return;
    pullStartedFor.current = user.id;

    let cancelled = false;
    void (async () => {
      const remote = await getRemoteAppearance(user.id);
      if (cancelled) return;

      const local = settingsRef.current;
      if (remote && parseDate(remote.updatedAt) > parseDate(local.updatedAt)) {
        await applySettings(remote);
      } else {
        lastPushedJson.current = JSON.stringify(local);
        await saveRemoteAppearance(local, user.id);
      }
      if (!cancelled) setPulledUserId(user.id);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, hydrated, applySettings]);

  // ── Écritures suivantes ──
  useEffect(() => {
    if (!user || pulledUserId !== user.id) return;
    const json = JSON.stringify(settings);
    if (json === lastPushedJson.current) return;

    const timer = setTimeout(() => {
      lastPushedJson.current = json;
      void saveRemoteAppearance(settings, user.id);
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [settings, user, pulledUserId]);

  return null;
}
