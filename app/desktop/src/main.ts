// app/desktop/src/main.ts
import { app, BrowserWindow, Menu, globalShortcut, ipcMain, nativeTheme } from 'electron';
import * as path from 'node:path';
import * as overlay from './ipc/overlay.js'; // <-- note the .js (TS -> dist/ipc/overlay.js)

let mainWin: BrowserWindow | null = null;

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Edit overlays',
          accelerator: 'CommandOrControl+Shift+E',
          type: 'checkbox',
          checked: overlay.inEditMode(),
          click: (item) => overlay.setEditMode(item.checked),
        },
        {
          label: 'Clear all overlays',
          accelerator: 'CommandOrControl+Shift+X',
          click: () => overlay.removeAllOverlays(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1140,
    height: 760,
    minWidth: 920,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111111' : '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // compiled by tsc + postbuild
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWin.setMenu(buildMenu());
  mainWin.on('ready-to-show', () => mainWin?.show());
  mainWin.on('closed', () => (mainWin = null));

  // IMPORTANT: load the real app shell (embeds your hosted Library)
  mainWin.loadFile(path.join(__dirname, '../windows/library.html'));
}

app.whenReady().then(() => {
  createMainWindow();

  // Shortcuts mirror the menu
  globalShortcut.register('CommandOrControl+Shift+E', overlay.toggleEditMode);
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* IPC wired to overlay helpers */
ipcMain.handle('overlay:create', (_e, id: string, url: string) => overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll', () => overlay.removeAllOverlays());
ipcMain.handle('overlay:setEditMode', (_e, on: boolean) => overlay.setEditMode(!!on));
ipcMain.handle('overlay:toggleEdit', () => overlay.toggleEditMode());
