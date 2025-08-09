import { app, BrowserWindow, ipcMain, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as overlay from './ipc/overlay';

const distDir      = path.join(app.getAppPath(), 'dist');
const preloadPath  = path.join(distDir, 'preload.cjs'); // <-- preload is CJS
const rendererHtml = path.join(distDir, 'renderer', 'index.html');
const libraryHtml  = path.join(app.getAppPath(), 'windows', 'library.html');

let mainWin: BrowserWindow | null = null;
let libraryWin: BrowserWindow | null = null;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    show: false,
    webPreferences: { preload: preloadPath, sandbox: false }
  });
  mainWin.on('ready-to-show', () => mainWin?.show());
  mainWin.on('closed', () => (mainWin = null));

  mainWin.loadURL(pathToFileURL(rendererHtml).toString());

  const menu = Menu.buildFromTemplate([
    {
      label: 'Stickers',
      submenu: [
        { label: 'Clear all', accelerator: 'CommandOrControl+Shift+X', click: overlay.removeAllOverlays },
        { label: 'Toggle click‑through', accelerator: 'CommandOrControl+Shift+E', click: overlay.toggleAllClickThrough },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function openLibraryWindow() {
  if (libraryWin && !libraryWin.isDestroyed()) {
    libraryWin.show();
    libraryWin.focus();
    return;
  }
  libraryWin = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: { preload: preloadPath, sandbox: false }
  });
  libraryWin.on('closed', () => (libraryWin = null));
  libraryWin.loadURL(pathToFileURL(libraryHtml).toString());
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
  globalShortcut.register('CommandOrControl+Shift+E', overlay.toggleAllClickThrough);
}

app.whenReady().then(() => {
  createMainWindow();
  registerShortcuts();
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* ───────────── IPC ───────────── */
ipcMain.handle('auth:login', async (_e, creds: { store: string; password: string }) => {
  // TODO: replace with real auth; we just check non-empty fields.
  if (!creds?.store || !creds?.password) return { ok: false, message: 'Missing credentials' };
  openLibraryWindow();
  if (mainWin && !mainWin.isDestroyed()) { mainWin.close(); }
  return { ok: true };
});

ipcMain.handle('ui:openLibrary', () => openLibraryWindow());
ipcMain.handle('ui:focusLibrary', () => libraryWin?.focus());

ipcMain.handle('overlay:create', (_e, id: string, url: string) => overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);
ipcMain.handle('overlay:toggleClickThrough', overlay.toggleAllClickThrough);
