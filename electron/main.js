// Powered by OnSpace.AI
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function createWindow() {
  await startServer();

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
    console.error('[auto-update]', err);
    sendToRenderer('error', { message: err?.message || String(err) });
  });

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      sendToRenderer('error', { message: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      sendToRenderer('error', { message: err?.message || String(err) });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  // Vérification automatique au lancement, uniquement pour informer
  // l'utilisateur (aucun téléchargement tant qu'il n'a pas cliqué sur le
  // bouton dans l'app).
  autoUpdater.checkForUpdates().catch((err) => console.error('[auto-update]', err));
}

ipcMain.handle('updater:get-version', () => app.getVersion());
ipcMain.handle('updater:is-packaged', () => app.isPackaged);

app.whenReady().then(async () => {
  await createWindow();
  setupAutoUpdate();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
