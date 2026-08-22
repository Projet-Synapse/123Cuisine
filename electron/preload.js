//////////////////////////////////////////////////////////////////////////
//                               Preload.js                             //
//////////////////////////////////////////////////////////////////////////
// API exposée au renderer. Trois ponts, et rien d'autre : mise à jour manuelle
// (hooks/useDesktopUpdater.ts), aperçu avant impression (utils/print.ts) et
// préférences propres au bureau (app/(parametres)/a-propos.tsx). Aucune autre
// capacité Node/Electron n'est exposée à la page web.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopUpdater', {
  isPackaged: () => ipcRenderer.invoke('updater:is-packaged'),
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  getLogTail: () => ipcRenderer.invoke('updater:get-log-tail'),
  showDownloadedFile: () => ipcRenderer.invoke('updater:show-downloaded-file'),
  onEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater:event', listener);
    return () => ipcRenderer.removeListener('updater:event', listener);
  },
});

// Aperçu avant impression : le Chromium d'Electron n'en fournit pas, on passe
// donc par le process principal (rendu -> PDF -> visionneuse).
contextBridge.exposeInMainWorld('desktopPrint', {
  preview: (html) => ipcRenderer.invoke('print:preview', html),
});

// Réglages qui n'existent que sur l'app de bureau.
contextBridge.exposeInMainWorld('desktopPrefs', {
  get: () => ipcRenderer.invoke('app:get-prefs'),
  setConfirmQuit: (value) => ipcRenderer.invoke('app:set-confirm-quit', value),
});
