// app/desktop/src/main.ts
import { app, BrowserWindow, shell, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

let mainWin: BrowserWindow | null = null;

// simple logfile in %APPDATA%/Icon Desktop/icon-desktop.log
const logDir = app.getPath('userData');
const logFile = path.join(logDir, 'icon-desktop.log');
function log(...args: unknown[]) {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`); } catch {}
}

function showErrorBox(title: string, content: string) {
  log('ERROR', title, content);
  try { dialog.showErrorBox(title, content); } catch {}
}

process.on('uncaughtException', (e: unknown) => {
  const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  log('uncaughtException', msg);
  showErrorBox('Crash in main', msg);
});

process.on('unhandledRejection', (e: unknown) => {
  const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  log('unhandledRejection', msg);
});

async function createMainWindow() {
  const appPath = app.getAppPath(); // points to app.asar in prod
  const preload = path.join(appPath, 'dist', 'preload.cjs');
  const libraryHtml = path.join(appPath, 'windows', 'library.html');

  log('appPath', appPath);
  log('preload', preload, 'exists?', fs.existsSync(preload));
  log('libraryHtml', libraryHtml, 'exists?', fs.existsSync(libraryHtml));

  if (!fs.existsSync(libraryHtml)) {
    // last‑ditch: try dist/renderer (your earlier placeholder)
    const fallback = path.join(appPath, 'dist', 'renderer', 'index.html');
    log('library missing, fallback to', fallback, 'exists?', fs.existsSync(fallback));
  }

  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // we’ll show on ready or timeout
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: false,
    },
  });

  // helpful diagnostics in prod
  mainWin.webContents.on('did-finish-load', () => { log('did-finish-load'); });
  mainWin.webContents.on('did-fail-load', (_, code, desc, url, isMainFrame) => {
    const s = `did-fail-load code=${code} desc=${desc} url=${url} main=${isMainFrame}`;
    log(s);
    showErrorBox('Failed to load UI', s);
    // always show *something* so the app isn't invisible
    if (mainWin && !mainWin.isVisible()) mainWin.show();
  });

  // open external links in default browser
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // try library; if missing, fall back to placeholder
  const target = fs.existsSync(libraryHtml)
    ? libraryHtml
    : path.join(appPath, 'dist', 'renderer', 'index.html');

  log('loading file', target);
  await mainWin.loadFile(target).catch((e: unknown) => {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    log('loadFile error', msg);
    showErrorBox('Load error', msg);
  });

  // show ASAP
  mainWin.once('ready-to-show', () => {
    log('ready-to-show');
    if (mainWin) { mainWin.show(); mainWin.focus(); }
  });
  // force show after 1500ms even if ready-to-show never fires
  setTimeout(() => {
    if (mainWin && !mainWin.isVisible()) {
      log('force show after timeout');
      mainWin.show();
      mainWin.focus();
    }
  }, 1500);

  mainWin.on('closed', () => { mainWin = null; });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(() => {
  createMainWindow().catch((e) => {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    log('createMainWindow error', msg);
    showErrorBox('Boot error', msg);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow().catch(()=>{});
  });
});
