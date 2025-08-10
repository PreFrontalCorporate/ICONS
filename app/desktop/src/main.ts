// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain, globalShortcut, Menu, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function distPath(...parts: string[]) {
  return path.join(app.getAppPath(), 'dist', ...parts);
}
const asFileUrl = (p: string) => pathToFileURL(p).toString();

// Always import overlay via file:// and explicit .js from asar
const overlayModuleUrl = () => asFileUrl(distPath('ipc', 'overlay.js'));

// Use a persistent partition so cookies/sessions survive restarts
const PARTITION = 'persist:icon';
const ses = session.fromPartition(PARTITION);

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
      // tie the window to our persistent session (typed way)
      partition: PARTITION,
      contextIsolation: true,
      sandbox: false,
      preload: distPath('preload.cjs'),
    },
  });

  // Always load the local HTML that iframes the hosted web app. :contentReference[oaicite:3]{index=3}
  const libraryHtml = path.join(app.getAppPath(), 'windows', 'library.html');
  win.loadFile(libraryHtml);
  win.once('ready-to-show', () => win.show());

  // (debug) open devtools if you launch with ICON_DEBUG=1
  if (process.env.ICON_DEBUG) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Helpful: print where Chromium is keeping this profile on disk
  console.log('[userData]', app.getPath('userData'));

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

  // IPC from renderer: pin/clear overlays
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
