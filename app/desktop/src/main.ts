// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain, globalShortcut, Menu } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function distPath(...parts: string[]) {
  return path.join(app.getAppPath(), 'dist', ...parts);
}

function asFileUrl(p: string) {
  return pathToFileURL(p).toString();
}

function overlayModuleUrl() {
  // Important: explicit .js so Node’s ESM resolver finds it inside asar.
  const p = distPath('ipc', 'overlay.js');
  return asFileUrl(p);
}

async function withOverlay<T>(fn: (overlay: any) => T | Promise<T>) {
  const mod = await import(overlayModuleUrl());
  return fn(mod);
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    show: false,
    webPreferences: {
      // Preload for the top-level window (not the overlay windows)
      preload: distPath('preload.cjs'),
      sandbox: false,
    },
  });

  // Use the local HTML that iframes the web library
  const libraryHtml = path.join(app.getAppPath(), 'windows', 'library.html');
  win.loadFile(libraryHtml);
  win.once('ready-to-show', () => win.show());

  // Quick menu with "Clear all stickers"
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear all stickers',
          accelerator: 'Ctrl+Shift+X',
          click: () => withOverlay(o => o.removeAllOverlays()),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]);
  win.setMenu(menu);

  // Global shortcut too
  globalShortcut.register('CommandOrControl+Shift+X', () =>
    withOverlay(o => o.removeAllOverlays()),
  );
}

app.whenReady().then(() => {
  createMainWindow();

  // IPC from the renderer (library iframe posts → preload forwards → main)
  ipcMain.handle('overlay:create', (_e, id: string, url: string) =>
    withOverlay(o => o.createOverlay(id, url)),
  );
  ipcMain.handle('overlay:clearAll', () =>
    withOverlay(o => o.removeAllOverlays()),
  );
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
