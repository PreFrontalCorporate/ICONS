// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain, globalShortcut, Menu } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// dist folder inside app.asar
const distDir   = join(app.getAppPath(), 'dist');
const preload   = join(distDir, 'preload.cjs');            // <- CJS preload (postbuild renames it)
const indexHtml = join(distDir, 'renderer', 'index.html');

// ESM-safe imports that also work inside app.asar
const overlayMod  = import(new URL('./ipc/overlay.js',  import.meta.url).href);
const stickersMod = import(new URL('./ipc/stickers.js', import.meta.url).href);

function buildMenu(removeAll: () => void) {
  return Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Clear all stickers', accelerator: 'Ctrl+Shift+X', click: removeAll },
      { type: 'separator' },
      { role: 'quit' },
    ]},
  ]);
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 880,
    height: 560,
    show: false,
    webPreferences: {
      preload,
      sandbox: false, // required for contextBridge
    },
  });

  win.setMenu(null); // temporary – we set a menu after overlay module is ready
  await win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(async () => {
  const overlay  = await overlayMod;   // { createOverlay, removeAllOverlays }
  const stickers = await stickersMod;  // { getMyStickers }

  // UI window
  await createMainWindow();

  // Menu + hotkey to clear
  const menu = buildMenu(overlay.removeAllOverlays);
  BrowserWindow.getAllWindows()[0]?.setMenu(menu);
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);

  // IPC
  ipcMain.handle('overlay:create', (_e, id: string, url: string) =>
    overlay.createOverlay(id, url)
  );
  ipcMain.handle('overlay:clearAll', () => overlay.removeAllOverlays());
  ipcMain.handle('stickers:list', (_e, token: string) =>
    stickers.getMyStickers(token)
  );
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
