import { app, BrowserWindow, globalShortcut, ipcMain, Menu, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const isDev = !app.isPackaged;

function log(...args: unknown[]) {
  try {
    const line = `[${new Date().toISOString()}] ${args.map(a => String(a)).join(' ')}\n`;
    const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
    fs.appendFileSync(logPath, line);
  } catch {}
  // eslint-disable-next-line no-console
  console.log('[main]', ...args);
}

// Robust preload resolution (dev builds have preload.js; packaged build renames to preload.cjs)
function resolvePreload() {
  const dir = __dirname;
  const cjs = path.join(dir, 'preload.cjs');
  const js  = path.join(dir, 'preload.js');
  return fs.existsSync(cjs) ? cjs : js;
}

let mainWin: BrowserWindow | null = null;

// lazy import to avoid circular import during transpile
const overlay = {
  create: (id: string, url: string) => import('./ipc/overlay').then(m => m.createOverlay(id, url)),
  clearAll: () => import('./ipc/overlay').then(m => m.removeAllOverlays())
};

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Clear all stickers', accelerator: 'CommandOrControl+Shift+X', click: () => overlay.clearAll() },
        { type: 'separator' },
        { role: 'quit' },
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open logs folder',
          click: () => shell.showItemInFolder(path.join(app.getPath('userData'), 'icon-desktop.log'))
        }
      ]
    }
  ]);
}

function createMainWindow() {
  const preloadPath = resolvePreload();

  mainWin = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#151515',
    autoHideMenuBar: false,
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWin.setMenu(buildMenu());
  log('Using preload:', preloadPath);

  // Load the in‑app Library window (it iframes the hosted Library UI and talks via postMessage).
  // File lives in app/desktop/windows/library.html
  const libraryHtml = path.join(__dirname, '../windows/library.html');
  const fileUrl = `file://${libraryHtml.replace(/\\/g, '/')}`;
  log('Loading Library:', fileUrl);
  mainWin.loadURL(fileUrl).catch(err => log('loadURL threw:', err?.stack || String(err)));

  mainWin.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', code, desc, url);
    const html = Buffer.from(`
      <!doctype html><meta charset="utf-8">
      <title>Icon Desktop - Error</title>
      <body style="font:14px system-ui;padding:24px;background:#111;color:#eee;">
        <h1>Icon Desktop</h1>
        <p>Renderer failed to load.</p>
        <pre style="white-space:pre-wrap;background:#222;padding:12px;border-radius:8px;">${desc} (${code})
Tried: ${fileUrl}</pre>
      </body>`);
    mainWin?.loadURL('data:text/html;base64,' + html.toString('base64'));
  });

  mainWin.on('ready-to-show', () => mainWin?.show());
  mainWin.on('closed', () => { mainWin = null; });

  // Open external links in the OS browser
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    try { mainWin.webContents.openDevTools({ mode: 'detach' } as any); } catch {}
  }
}

app.whenReady().then(() => {
  createMainWindow();
  // Global hotkey to clear everything fast
  globalShortcut.register('CommandOrControl+Shift+X', () => overlay.clearAll());
}).catch(e => log('app.whenReady error', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });

/* ───────── IPC: overlay control ───────── */
ipcMain.handle('overlay:create', (_e, id: string, url: string) => overlay.create(id, url));
ipcMain.handle('overlay:clearAll', () => overlay.clearAll());
