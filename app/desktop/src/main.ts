// app/desktop/src/main.ts
import { app, BrowserWindow, shell, session, screen, globalShortcut } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';

// ---------- logging ----------
const here = fileURLToPath(new URL('.', import.meta.url));
let mainWindow: BrowserWindow | null = null;

let appLogPath = '';
function log(...args: any[]) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { if (appLogPath) appendFileSync(appLogPath, line); } catch {}
  // keep console logging for --enable-logging
  // eslint-disable-next-line no-console
  console.log(line.trim());
}

// ---------- resource resolution ----------
function resolveResource(...parts: string[]) {
  // When packaged, app files live under process.resourcesPath/app.asar
  const base = app.isPackaged ? join(process.resourcesPath, 'app.asar') : here;
  return join(base, ...parts);
}

// ---------- window helpers ----------
function ensureOnScreen(win: BrowserWindow) {
  try {
    const b = win.getBounds();
    const displays = screen.getAllDisplays();
    const inAnyDisplay = displays.some(d => {
      const wa = d.workArea; // x, y, width, height
      const right = b.x + Math.max(60, b.width);
      const bottom = b.y + Math.max(60, b.height);
      return right > wa.x && b.x < wa.x + wa.width && bottom > wa.y && b.y < wa.y + wa.height;
    });

    if (!inAnyDisplay) {
      const wa = screen.getPrimaryDisplay().workArea;
      const width = Math.min(Math.max(1100, Math.floor(wa.width * 0.7)), wa.width);
      const height = Math.min(Math.max(720, Math.floor(wa.height * 0.75)), wa.height);
      const x = wa.x + Math.floor((wa.width - width) / 2);
      const y = wa.y + Math.floor((wa.height - height) / 2);
      win.setBounds({ x, y, width, height });
      log('ensureOnScreen → centered window', JSON.stringify({ x, y, width, height }));
    }
  } catch {}
}

function forceFront(win: BrowserWindow) {
  try {
    win.show();
    win.focus();
    // If something still covers us, briefly pulse always-on-top to surface
    if (!win.isVisible() || !win.isFocused()) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.show();
      win.focus();
      setTimeout(() => {
        try { win.setAlwaysOnTop(false); } catch {}
      }, 750);
      log('forceFront → pulsed always-on-top');
    }
  } catch {}
}

// ---------- main window ----------
async function createWindow() {
  const preload = resolveResource('dist', 'preload.cjs');
  const libraryHtml = resolveResource('windows', 'library.html');
  const fallbackHtml = resolveResource('dist', 'renderer', 'index.html');

  log('appPath', resolveResource());
  log('preload', preload, 'exists?', String(existsSync(preload)));
  log('libraryHtml', libraryHtml, 'exists?', String(existsSync(libraryHtml)));
  log('fallbackHtml', fallbackHtml, 'exists?', String(existsSync(fallbackHtml)));

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,             // show once ready + surfaced
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    center: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,      // host <webview> in library.html
    },
  });

  // Security + external links: open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });

  // <webview> hardening + preload injection
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const webviewPreload = resolveResource('windows', 'webview-preload.js');
    webPreferences.preload = webviewPreload;
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    // enforce our persisted partition for auth/session
    if (!params.partition) params.partition = 'persist:icon-app';
    log('will-attach-webview → preload', webviewPreload, 'partition', params.partition);
  });

  // Ready lifecycle
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    ensureOnScreen(mainWindow);
    forceFront(mainWindow);
    log('ready-to-show');
  });

  // Hard fallback if something stalls
  setTimeout(() => { if (mainWindow) forceFront(mainWindow); }, 2000);

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return;
    ensureOnScreen(mainWindow);
    forceFront(mainWindow);
    log('did-finish-load');
  });
  mainWindow.on('unresponsive', () => log('renderer unresponsive'));

  try {
    if (!existsSync(libraryHtml)) throw new Error('library.html not found');
    await mainWindow.loadFile(libraryHtml);
    log('loaded library.html');
  } catch (err: any) {
    log('loadFile(libraryHtml) failed:', err?.message ?? String(err));
    if (existsSync(fallbackHtml)) {
      await mainWindow.loadFile(fallbackHtml);
      log('loaded fallback renderer/index.html');
    } else {
      mainWindow.loadURL('about:blank');
      log('loaded about:blank (no html available)');
    }
  }

  // keep our overlay panel shortcut
  try {
    globalShortcut.register('CommandOrControl+Shift+O', () => {
      if (mainWindow) mainWindow.webContents.send('overlay:panel/toggle');
    });
  } catch {}
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------- single instance & lifecycle ----------
function setupSingleInstance() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on('second-instance', () => { if (mainWindow) forceFront(mainWindow); });
}

app.whenReady().then(() => {
  // prepare log path now that app is ready
  const userData = app.getPath('userData');
  try { mkdirSync(userData, { recursive: true }); } catch {}
  appLogPath = join(userData, 'icon-desktop.log');
  log('userData', userData);

  // conservative CORS/permissions on the library partition
  const lib = session.fromPartition('persist:icon-app');
  lib.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));

  setupSingleInstance();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});
