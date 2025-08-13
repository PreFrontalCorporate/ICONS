import { app, BrowserWindow, ipcMain, globalShortcut, WebContents } from 'electron';
import * as path from 'node:path';

let mainWin: BrowserWindow | null = null;
const overlays = new Set<BrowserWindow>();

function sendOverlayCount() {
  const n = overlays.size;
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('overlay:count', n));
}

function overlayHtmlPath() {
  return path.join(app.getAppPath(), 'windows', 'overlay.html');
}

function overlayPreloadPath() {
  return path.join(app.getAppPath(), 'windows', 'overlay-preload.js');
}

function webviewPreloadPath() {
  return path.join(app.getAppPath(), 'windows', 'webview-preload.js');
}

function createOverlay(imageUrl: string) {
  const win = new BrowserWindow({
    width: 480,
    height: 480,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: overlayPreloadPath(),
      sandbox: false,
    },
  });

  win.on('closed', () => {
    overlays.delete(win);
    sendOverlayCount();
  });

  win.loadFile(overlayHtmlPath(), { hash: encodeURIComponent(imageUrl) });
  overlays.add(win);
  sendOverlayCount();
  return win;
}

async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist', 'preload.cjs'),
      webviewTag: true,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const lib = path.join(app.getAppPath(), 'windows', 'library.html');
  await mainWin.loadFile(lib);

  // HUD toggle — support both O and 0 (users press both!)
  const toggle = () => mainWin?.webContents.send('overlay:panel/toggle');
  const clearAll = () => { for (const w of [...overlays]) w.close(); sendOverlayCount(); };

  globalShortcut.register('CommandOrControl+Shift+O', toggle);
  globalShortcut.register('CommandOrControl+Shift+0', toggle);
  globalShortcut.register('CommandOrControl+Shift+Backspace', clearAll);
}

// Force-attach absolute preload + persisted partition to every <webview>
app.on('web-contents-created', (_evt, contents: WebContents) => {
  contents.on('will-attach-webview', (_event, params) => {
    params.preload = webviewPreloadPath();
    params.partition = 'persist:icon-app';
    try {
      console.log('[will-attach-webview] preload=%s partition=%s', params.preload, params.partition);
    } catch {}
  });
});

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());

// IPC for overlays
ipcMain.handle('overlay/pin', (_e, url: string) => {
  createOverlay(url);
  return overlays.size;
});

ipcMain.handle('overlay/count', () => overlays.size);

ipcMain.handle('overlay/clearAll', () => {
  for (const w of [...overlays]) w.close();
  return overlays.size;
});

// Called from the overlay window itself to close just that one
ipcMain.handle('overlay/closeSelf', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && overlays.has(win)) win.close();
});
