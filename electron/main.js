// Powered by OnSpace.AI
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const http = require('http');
const fs = require('fs');
const path = require('path');

// electron-updater ne journalise rien de lisible par défaut dans une build
// packagée (pas de console visible sans terminal attaché) : on branche
// electron-log pour que chaque étape (vérification, téléchargement, erreur…)
// finisse dans un fichier qu'on peut aller récupérer après coup. Chemin par
// défaut : %APPDATA%\MaCuisine\logs\main.log sur Windows (voir bouton
// "Copier le journal" dans Réglages → Mises à jour).
log.transports.file.level = 'info';
log.transports.console.level = 'info';
autoUpdater.logger = log;

const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = 47821;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

// CSP volontairement large sur *.supabase.co / Google : le projet Supabase peut
// changer (cf. migration en cours) et la connexion Google passe par un
// redirect complet vers accounts.google.com. Tout le reste du web est bloqué.
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://*.googleapis.com",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self' https://*.supabase.co https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const requested = path.normalize(path.join(DIST_DIR, urlPath));

      // path.normalize peut résoudre en dehors de DIST_DIR (ex: "..%2f..").
      // On exige que le chemin résolu soit DIST_DIR lui-même ou un de ses
      // enfants directs (le simple startsWith(DIST_DIR) laisserait passer
      // un dossier voisin du type "dist-evil").
      if (requested !== DIST_DIR && !requested.startsWith(DIST_DIR + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }

      const serveFile = (filePath) => {
        fs.readFile(filePath, (err, data) => {
          const headers = { ...SECURITY_HEADERS };
          if (err) {
            fs.readFile(path.join(DIST_DIR, 'index.html'), (fallbackErr, fallbackData) => {
              if (fallbackErr) {
                res.writeHead(404, headers);
                res.end('Not found');
                return;
              }
              res.writeHead(200, { ...headers, 'Content-Type': 'text/html' });
              res.end(fallbackData);
            });
            return;
          }
          const ext = path.extname(filePath);
          res.writeHead(200, { ...headers, 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(data);
        });
      };

      fs.stat(requested, (err, stats) => {
        if (!err && stats.isDirectory()) {
          serveFile(path.join(requested, 'index.html'));
        } else {
          serveFile(requested);
        }
      });
    });

    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let mainWindow;
let httpServer;
let isQuittingForUpdate = false;

async function createWindow() {
  httpServer = await startServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    icon: path.join(__dirname, '..', 'assets', 'images', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // La fenêtre d'impression (utils/print.ts) ouvre une popup vide ('about:blank')
  // qu'elle remplit elle-même via document.write : on l'autorise. Tout le reste
  // (liens externes, cible _blank quelconque) s'ouvre dans le navigateur système
  // plutôt que dans une fenêtre Electron non restreinte.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`${ORIGIN}/`);
}

// ─────────────────────────────────────────────────────────────
// Mise à jour : téléchargement manuel, confirmé depuis l'app.
// L'UI React (hooks/useDesktopUpdater.ts) pilote tout via IPC ;
// on se contente ici de relayer les événements d'electron-updater.
// ─────────────────────────────────────────────────────────────

function sendToRenderer(type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:event', { type, payload });
  }
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => sendToRenderer('checking'));
  autoUpdater.on('update-available', (info) => sendToRenderer('available', { version: info.version }));
  autoUpdater.on('update-not-available', (info) => sendToRenderer('not-available', { version: info.version }));
  autoUpdater.on('download-progress', (progress) => sendToRenderer('downloading', { percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => sendToRenderer('downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => {
    log.error('[auto-update] event error:', err);
    sendToRenderer('error', { message: err?.message || String(err) });
  });

  // Sur Windows, l'installeur NSIS vérifie si MaCuisine.exe tourne encore
  // avant d'écraser les fichiers — s'il le voit encore actif (fenêtre à
  // peine fermée, process encore en train de se terminer), il boucle sur
  // "Veuillez la fermer manuellement". On ferme tout explicitement ici,
  // avant qu'electron-updater ne lance l'installeur, pour lui laisser un
  // maximum de temps pour disparaître de la liste des processus.
  autoUpdater.on('before-quit-for-update', () => {
    isQuittingForUpdate = true;
    log.info('[auto-update] before-quit-for-update: fermeture du serveur local et des fenêtres');
    if (httpServer) {
      try { httpServer.close(); } catch (err) { log.error('[auto-update] httpServer.close failed:', err); }
    }
    BrowserWindow.getAllWindows().forEach((w) => { try { w.destroy(); } catch {} });
  });

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      log.error('[auto-update] check failed:', err);
      sendToRenderer('error', { message: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      log.error('[auto-update] download failed:', err);
      sendToRenderer('error', { message: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:install', () => {
    try {
      log.info('[auto-update] quitAndInstall requested by user');
      autoUpdater.quitAndInstall();
      return { ok: true };
    } catch (err) {
      log.error('[auto-update] quitAndInstall failed:', err);
      sendToRenderer('error', { message: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Vérification automatique au lancement, uniquement pour informer
  // l'utilisateur (aucun téléchargement tant qu'il n'a pas cliqué sur le
  // bouton dans l'app).
  autoUpdater.checkForUpdates().catch((err) => log.error('[auto-update] startup check failed:', err));
}

// Filet de sécurité : toute exception non interceptée dans le process
// principal finit dans le même journal plutôt que de faire planter l'app en
// silence sans aucune trace exploitable.
process.on('uncaughtException', (err) => log.error('[main] uncaughtException:', err));
process.on('unhandledRejection', (err) => log.error('[main] unhandledRejection:', err));

ipcMain.handle('updater:get-version', () => app.getVersion());
ipcMain.handle('updater:is-packaged', () => app.isPackaged);

// Verrou mono-instance : sans ça, deux MaCuisine.exe peuvent coexister
// (double-clic accidentel, relance pendant qu'une ancienne instance traîne
// encore) — exactement le genre de situation où l'installeur NSIS retrouve
// "MaCuisine.exe" dans la liste des processus alors qu'on croit l'avoir
// fermée, et boucle indéfiniment sur "Veuillez la fermer manuellement".
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  log.info('[main] Une autre instance de MaCuisine tourne déjà — fermeture.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('before-quit', () => {
    if (httpServer) {
      try { httpServer.close(); } catch (err) { log.error('[main] httpServer.close on before-quit failed:', err); }
    }
  });

  app.whenReady().then(async () => {
    await createWindow();
    setupAutoUpdate();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    // Ne jamais rouvrir de fenêtre pendant qu'on est en train de quitter
    // pour installer une mise à jour (Windows peut envoyer 'activate' si
    // l'utilisateur clique sur l'icône pendant que l'app se termine).
    if (!isQuittingForUpdate && BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

// Permet de récupérer les dernières lignes du journal directement depuis
// l'app (bouton "Copier le journal" dans Réglages), sans avoir à aller
// fouiller dans AppData à la main.
ipcMain.handle('updater:get-log-tail', () => {
  try {
    const logPath = log.transports.file.getFile().path;
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/);
    return { ok: true, path: logPath, content: lines.slice(-200).join('\n') };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});
