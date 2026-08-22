//////////////////////////////////////////////////////////////////////////
//                        🔄 UseDesktopUpdater.ts                       //
//////////////////////////////////////////////////////////////////////////

/*
 * Pilote la mise à jour de l'app desktop (Electron) depuis React : vérifie, télécharge et installe uniquement sur confirmation explicite de l'utilisateur, via l'API exposée par electron/preload.js.
 */

import { useCallback, useEffect, useState } from 'react';

export type UpdaterStatus =
  | 'unavailable'   // pas dans l'app desktop (web / mobile)
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface DesktopUpdaterBridge {
  isPackaged: () => Promise<boolean>;
  getVersion: () => Promise<string>;
  check: () => Promise<{ ok: boolean; error?: string }>;
  download: () => Promise<{ ok: boolean; error?: string }>;
  install: () => Promise<{ ok: boolean }>;
  getLogTail: () => Promise<{ ok: boolean; path?: string; content?: string; error?: string }>;
  showDownloadedFile: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  onEvent: (callback: (data: { type: string; payload?: any }) => void) => () => void;
}

declare global {
  interface Window {
    desktopUpdater?: DesktopUpdaterBridge;
  }
}

interface UpdaterState {
  status: UpdaterStatus;
  currentVersion: string | null;
  availableVersion: string | null;
  progress: number | null;
  error: string | null;
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.desktopUpdater;
}

// Pilote la mise à jour de l'app desktop (Electron) depuis React : vérifie,
// informe, télécharge et installe UNIQUEMENT sur confirmation de
// l'utilisateur (voir electron/main.js + electron/preload.js pour le
// pendant côté process principal).
export function useDesktopUpdater() {
  const isDesktop = isDesktopApp();
  const [isPackaged, setIsPackaged] = useState(false);
  const [state, setState] = useState<UpdaterState>({
    status: isDesktop ? 'idle' : 'unavailable',
    currentVersion: null,
    availableVersion: null,
    progress: null,
    error: null,
  });

  useEffect(() => {
    if (!isDesktop || !window.desktopUpdater) return;
    let cancelled = false;

    window.desktopUpdater.getVersion().then(v => { if (!cancelled) setState(s => ({ ...s, currentVersion: v })); });
    window.desktopUpdater.isPackaged().then(p => { if (!cancelled) setIsPackaged(p); });

    const unsubscribe = window.desktopUpdater.onEvent((data) => {
      switch (data.type) {
        case 'checking':
          setState(s => ({ ...s, status: 'checking', error: null }));
          break;
        case 'available':
          setState(s => ({ ...s, status: 'available', availableVersion: data.payload?.version ?? null }));
          break;
        case 'not-available':
          setState(s => ({ ...s, status: 'not-available' }));
          break;
        case 'downloading':
          setState(s => ({ ...s, status: 'downloading', progress: typeof data.payload?.percent === 'number' ? data.payload.percent : null }));
          break;
        case 'downloaded':
          setState(s => ({ ...s, status: 'downloaded', availableVersion: data.payload?.version ?? s.availableVersion, progress: 100 }));
          break;
        case 'error':
          setState(s => ({ ...s, status: 'error', error: data.payload?.message || 'Erreur inconnue' }));
          break;
      }
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [isDesktop]);

  const checkForUpdates = useCallback(async () => {
    if (!isDesktop || !window.desktopUpdater) return;
    if (!isPackaged) {
      setState(s => ({ ...s, status: 'error', error: "Indisponible hors version installée (mode développement)." }));
      return;
    }
    setState(s => ({ ...s, status: 'checking', error: null }));
    await window.desktopUpdater.check();
  }, [isDesktop, isPackaged]);

  const downloadUpdate = useCallback(async () => {
    if (!isDesktop || !window.desktopUpdater) return;
    setState(s => ({ ...s, status: 'downloading', progress: 0, error: null }));
    await window.desktopUpdater.download();
  }, [isDesktop]);

  const installUpdate = useCallback(async () => {
    if (!isDesktop || !window.desktopUpdater) return;
    await window.desktopUpdater.install();
  }, [isDesktop]);

  const getLogTail = useCallback(async () => {
    if (!isDesktop || !window.desktopUpdater) return null;
    return window.desktopUpdater.getLogTail();
  }, [isDesktop]);

  // Filet de secours : sur certaines machines, le redémarrage automatique
  // (installUpdate) se heurte à une course avec l'installeur Windows qui
  // voit encore l'app "présente" au moment où il se relance. Ça révèle le
  // fichier déjà téléchargé dans l'explorateur pour que l'utilisateur le
  // lance lui-même, une fois l'app fermée à son rythme.
  const showDownloadedFile = useCallback(async () => {
    if (!isDesktop || !window.desktopUpdater) return null;
    return window.desktopUpdater.showDownloadedFile();
  }, [isDesktop]);

  return { ...state, isDesktop, isPackaged, checkForUpdates, downloadUpdate, installUpdate, getLogTail, showDownloadedFile };
}
