// Main process – robust boot with logging + Library shell
import { app, BrowserWindow, ipcMain, Menu, globalShortcut } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

let mainWin: BrowserWindow | null = null;

/* ───── tiny logger to %APPDATA%/Icon Desktop/logs/main.log ───── */
const LOG_DIR  = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'main.log');
function log(...a: any[]) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      `[${new Date().toISOString()}] ${a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')}\n`
    );
  } catch {}
}
process.on('uncaughtException',  e => log('uncaughtException',  e?.stack || e));
process.on('unhandledRejection', e => log('unhandledRejection', e?.stack || e));

/* ───── single instance ───── */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); }
  });
}

/* ───── main window ───── */
async function createMainWindow() {
  log('createMainWindow');
  const preload     = path.join(__dirname, 'preload.cjs');                 // <— correct file we ship
  const libraryHtml = path.join(__dirname, '../windows/library.html');     // preferred UI
  const fallback    = path.join(__dirname, 'renderer', 'index.html');      // tiny placeholder

  mainWin = new BrowserWindow({
    width: 1024, height: 720, minWidth: 800, minHeight: 560,
    backgroundColor: '#111111',
    show: true,                                  // never start hidden
    webPreferences: {
      preload,
      sandbox: false,
      contextIsolation: true,
    }
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'fileMenu', submenu: [
      { label: 'Clear all stickers', accelerator: 'Ctrl+Shift+X',
        click: () => import('./ipc/overlay.js').then(m => m.removeAllOverlays()) },
      { type: 'separator' }, { role: 'quit' }
    ]},
    { role: 'viewMenu' }
  ]));

  mainWin.webContents.on('did-fail-load', (_e, code, desc, url) => log('did-fail-load', code, desc, url));
  mainWin.webContents.on('render-process-gone', (_e, details) => log('render-process-gone', details));
  mainWin.on('ready-to-show', () => { log('ready-to-show'); mainWin?.show(); mainWin?.focus(); });
  mainWin.on('closed', () => { log('main window closed'); mainWin = null; });

  const useLibrary = fs.existsSync(libraryHtml);
  log('loading', useLibrary ? libraryHtml : fallback);

  if (useLibrary) {
    mainWin.loadFile(libraryHtml);
  } else {
    const { pathToFileURL } = await import('node:url');
    mainWin.loadURL(pathToFileURL(fallback).toString());
  }
}

/* ───── app lifecycle + IPC ───── */
app.whenReady().then(() => {
  app.setAppUserModelId('com.prefc.icon-desktop');
  log('app ready; userData=', app.getPath('userData'));
  createMainWindow();
  globalShortcut.register('CommandOrControl+Shift+X',
    () => import('./ipc/overlay.js').then(m => m.removeAllOverlays()));
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

ipcMain.handle('overlay:create', (_e, id: string, url: string) =>
  import('./ipc/overlay.js').then(m => m.createOverlay(id, url)));
ipcMain.handle('overlay:clearAll', () =>
  import('./ipc/overlay.js').then(m => m.removeAllOverlays()));
