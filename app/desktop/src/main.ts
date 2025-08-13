import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
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
      preload: path.join(app.getAppPath(), 'windows', 'overlay-preload.js'),
      sandbox: false,
    },
  });
  win.on('closed', () => { overlays.delete(win); sendOverlayCount(); });
  win.loadFile(overlayHtmlPath(), { hash: encodeURIComponent(imageUrl) });
  overlays.add(win); sendOverlayCount();
  return win;
}

async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist', 'preload.cjs'),
      sandbox: false,
    },
  });

  await mainWin.loadURL('https://icon-web-two.vercel.app/library');

  const toggle = () => mainWin?.webContents.send('overlay:panel/toggle');
  globalShortcut.register('CommandOrControl+Shift+O', toggle);
  globalShortcut.register('CommandOrControl+Shift+0', toggle);
  globalShortcut.register('CommandOrControl+Shift+Backspace', () => {
    for (const w of [...overlays]) w.close();
    sendOverlayCount();
  });
}

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());

// IPC
ipcMain.handle('overlay/pin', (_e, url: string) => { createOverlay(url); return overlays.size; });
ipcMain.handle('overlay/count', () => overlays.size);
ipcMain.handle('overlay/clearAll', () => { for (const w of [...overlays]) w.close(); return overlays.size; });
ipcMain.handle('overlay/closeSelf', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && overlays.has(win)) win.close();
});
ipcMain.handle('app/openExternal', (_e, url: string) => shell.openExternal(url));
