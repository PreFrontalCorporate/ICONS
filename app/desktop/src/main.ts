// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain, session, screen } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let overlayCount = 0;

// --- util paths (work for unpacked + asar) ---
const appRoot      = app.getAppPath(); // points to app.asar root at runtime
const preloadPath  = path.join(appRoot, 'dist', 'preload.cjs');
const libraryHtml  = path.join(appRoot, 'windows', 'library.html');
const webviewPreloadPath = path.join(appRoot, 'windows', 'webview-preload.js');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#111111',
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: { color: '#111111', symbolColor: '#dddddd', height: 32 },
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
      webviewTag: true,
    },
  });

  session.fromPartition('persist:icon-app').setPermissionCheckHandler(() => true);

  mainWindow.webContents.on('will-attach-webview', (_e, webPreferences) => {
    webPreferences.preload = webviewPreloadPath;
    webPreferences.partition = 'persist:icon-app';
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.javascript = true;
  });

  mainWindow.loadFile(libraryHtml).catch(err => {
    console.error('Failed to load library.html', err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  setTimeout(() => {
    if (!mainWindow?.isVisible()) {
      console.log('force show after timeout');
      mainWindow?.show();
      mainWindow?.focus();
    }
  }, 1200);

  mainWindow.on('closed', () => (mainWindow = null));
}

// ---- Overlay handling -------------------------------------------------------

type AddStickerPayload = { packId: string; stickerId: string; src?: string };
type AddStickerResolved = AddStickerPayload & { basePath: string };

function createOverlayWindow(payload: AddStickerResolved) {
  const overlay = new BrowserWindow({
    width: 256,
    height: 256,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      devTools: false,
    },
  });

  const pt = screen.getCursorScreenPoint();
  const x = Math.max(0, (pt?.x ?? 120) - 64);
  const y = Math.max(0, (pt?.y ?? 120) - 64);
  overlay.setPosition(x, y);

  const data = encodeURIComponent(JSON.stringify(payload));
  overlay.loadURL(
    `data:text/html;charset=utf-8,` +
      encodeURIComponent(`
      <!doctype html>
      <html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%;background:transparent;overflow:hidden}
        img{max-width:100%;max-height:100%;display:block}
      </style></head>
      <body><img id="s"></body>
      <script>
        const p = JSON.parse(decodeURIComponent("${data}"));
        const guess = (p) => "file://" + p.basePath + "/" + p.packId + "/" + p.stickerId + ".webp";
        const src = p.src || guess(p);
        document.getElementById('s').src = src;
      </script>
      </html>
    `)
  );

  overlayCount += 1;
  mainWindow?.webContents.send('icon:overlay-count', overlayCount);

  overlay.on('closed', () => {
    overlayCount = Math.max(0, overlayCount - 1);
    mainWindow?.webContents.send('icon:overlay-count', overlayCount);
  });
}

ipcMain.on('icon:add-sticker', (_evt, payload: AddStickerPayload) => {
  try {
    const stickersBase = path.join(appRoot, 'packages', 'stickers', 'packs');
    const full: AddStickerResolved = { ...payload, basePath: stickersBase };
    createOverlayWindow(full);
  } catch (e) {
    console.error('add-sticker failed', e);
  }
});

// ---- App lifecycle ----------------------------------------------------------

app.once('ready', createMainWindow);

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
