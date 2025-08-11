// at top
import { app, BrowserWindow, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

let win: BrowserWindow | null = null;

// tiny file logger (no dependency)
function log(...args: unknown[]) {
  try {
    const line =
      args.map(a =>
        a instanceof Error ? (a.stack ?? a.message) :
        typeof a === 'string' ? a :
        JSON.stringify(a)
      ).join(' ');
    fs.appendFileSync(path.join(app.getPath('userData'), 'icon-desktop.log'), `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

process.on('uncaughtException', (e: unknown) => {
  log('uncaughtException', e);
});
process.on('unhandledRejection', (e: unknown) => {
  log('unhandledRejection', e);
});

function getPreloadPath() {
  // in dist, this file lives in dist/main.mjs; preload.cjs is sibling
  return app.isPackaged
    ? path.join(__dirname, 'preload.cjs')
    : path.join(__dirname, 'preload.cjs'); // dev also writes to dist via build:preload
}

function getLibraryHtml() {
  // During dev builds you kept windows/library.html at repo path.
  // After packaging, ship windows/** and load from resourcesPath.
  const devPath = path.resolve(__dirname, '..', 'windows', 'library.html');
  const prodPath = path.join(process.resourcesPath, 'windows', 'library.html');
  return app.isPackaged ? prodPath : devPath;
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,                      // prevent white flash
    backgroundColor: '#111111',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.on('ready-to-show', () => {
    if (!win) return;
    win.show();
    win.focus();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // open external links in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const html = getLibraryHtml();
  log('Loading UI:', html);
  await win.loadFile(html);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
    }
  });

  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}
