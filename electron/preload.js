//////////////////////////////////////////////////////////////////////////
//                               Preload.js                             //
//////////////////////////////////////////////////////////////////////////
// API exposée au renderer pour la mise à jour manuelle de l'app (voir
// hooks/useDesktopUpdater.ts). Aucune autre capacité Node/Electron n'est
// exposée à la page web par ce preload.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopUpdater', {
  isPackaged: () => ipcRenderer.invoke('updater:is-packaged'),
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  getLogTail: () => ipcRenderer.invoke('updater:get-log-tail'),
  onEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater:event', listener);
    return () => ipcRenderer.removeListener('updater:event', listener);
  },
});
