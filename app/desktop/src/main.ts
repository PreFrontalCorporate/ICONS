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

function createOverlay(imageUrl: string) {
  const win = new BrowserWindow({
    width: 480,
    height: 520,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'windows', 'overlay-preload.js'),
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist', 'preload.cjs'),
      webviewTag: true,
      sandbox: false,
      nodeIntegrationInSubFrames: true,
    },
  });

  const lib = path.join(app.getAppPath(), 'windows', 'library.html');
  await mainWin.loadFile(lib);

  globalShortcut.register('CommandOrControl+Shift+0', () => {
    mainWin?.webContents.send('overlay:panel/toggle');
  });

  globalShortcut.register('CommandOrControl+Shift+Backspace', () => {
    for (const w of [...overlays]) w.close();
    sendOverlayCount();
  });

  sendOverlayCount();
}

// Ensure the <webview> always gets our preload (absolute path) and a persisted session
app.on('web-contents-created', (_evt, contents: WebContents) => {
  contents.on('will-attach-webview', (event, params) => {
    params.preload = path.join(app.getAppPath(), 'windows', 'webview-preload.js');
    params.partition = 'persist:icon-app';
    // Conservative lockdown
    delete (params as any).webSecurity;
    // Debug breadcrumb in packaged builds
    try {
      console.log(`[will-attach-webview] preload=${params.preload} partition=${params.partition}`);
    } catch {}
  });
});

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());

// Close every overlay on app quit to avoid stragglers
app.on('before-quit', () => {
  for (const w of [...overlays]) {
    try { w.destroy(); } catch {}
  }
});

// IPC for overlays
ipcMain.handle('overlay/pin', (_e, payload: any) => {
  const url = typeof payload === 'string' ? payload : payload?.url || payload?.src;
  if (!url) return overlays.size;
  createOverlay(url);
  return overlays.size;
});

ipcMain.handle('overlay/count', () => overlays.size);

ipcMain.handle('overlay/clearAll', () => {
  for (const w of [...overlays]) w.close();
  sendOverlayCount();
  return overlays.size;
});

ipcMain.handle('overlay/closeSelf', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && overlays.has(win)) win.close();
});
