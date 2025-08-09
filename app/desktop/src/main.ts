// Main process (ESM via TS). Creates main window + transparent overlay.
// Loads renderer from dist/renderer/index.html and a CommonJS preload in dist/.
import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
import * as path from 'node:path';
import * as url from 'node:url';

let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // CJS preload
      contextIsolation: true,
      sandbox: true
    }
  });

  const indexFile = path.join(__dirname, 'renderer', 'index.html');
  mainWin.loadFile(indexFile);

  mainWin.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWin.on('closed', () => { mainWin = null; });
}

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  // Reuse renderer entry (can switch to a dedicated file later)
  overlayWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  overlayWin.setIgnoreMouseEvents(false);
  overlayWin.on('closed', () => { overlayWin = null; });
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();

  globalShortcut.register('CommandOrControl+Shift+X', () => {
    overlayWin?.webContents.send('stickers:clear-all');
  });
});

app.on('window-all-closed', () => {
  // keep app alive on macOS until user quits
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWin === null) createMainWindow();
});

// IPC from renderer
ipcMain.handle('stickers:list', async () => {
  // Later: read from packages/stickers/index.json on disk.
  return [];
});

ipcMain.on('overlay:set-click-through', (_evt, on: boolean) => {
  overlayWin?.setIgnoreMouseEvents(on, { forward: true });
});

// Guard: clear shortcuts
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
