// app/desktop/src/main.ts
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  dialog,
} from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Lazy ESM import that is safe inside asar on Windows/mac/Linux
type OverlayModule = typeof import('./ipc/overlay');
let _overlay: OverlayModule | null = null;
async function overlay(): Promise<OverlayModule> {
  if (_overlay) return _overlay;
  const modUrl = pathToFileURL(path.join(__dirname, 'ipc', 'overlay.js')).href;
  _overlay = (await import(modUrl)) as OverlayModule;
  return _overlay;
}

let mainWin: BrowserWindow;

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      role: 'fileMenu',
      submenu: [
        {
          label: 'Clear all stickers',
          accelerator: 'Ctrl+Shift+X',
          click: async () => (await overlay()).removeAllOverlays(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // expose window.iconOverlay to the library HTML
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
    },
  });

  mainWin.setMenu(buildMenu());

  // ship a tiny wrapper that iframes the hosted Library UI
  mainWin.loadFile(path.join(__dirname, '../windows/library.html'));

  // show a small tip the first time of each major.minor
  if (app.getVersion().endsWith('.0')) {
    dialog.showMessageBox(mainWin, {
      type: 'info',
      title: 'icon',
      message:
        'Tip:  Ctrl + Shift + X removes all stickers.\nESC closes a focused overlay.',
    });
  }
}

/* ───────────────────────── App lifecycle ───────────────────────── */

app.whenReady().then(async () => {
  createMainWindow();

  // global hotkey to nuke overlays quickly
  globalShortcut.register('CommandOrControl+Shift+X', async () => {
    (await overlay()).removeAllOverlays();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ───────────────────────── IPC (renderer → main) ───────────────────────── */

ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
  return (await overlay()).createOverlay(id, url);
});

ipcMain.handle('overlay:clearAll', async () => {
  return (await overlay()).removeAllOverlays();
});
