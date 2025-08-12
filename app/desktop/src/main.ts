// app/desktop/src/main.ts
import { app, BrowserWindow, shell, globalShortcut, ipcMain, WebContents } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { registerOverlayIpc } from './ipc/overlay';

const here = fileURLToPath(new URL('.', import.meta.url));
let mainWindow: BrowserWindow | null = null;

let appLogPath = '';
function log(...args: any[]) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { if (appLogPath) appendFileSync(appLogPath, line); } catch {}
  // eslint-disable-next-line no-console
  console.log(line.trim());
}

function resolveResource(...parts: string[]) {
  const base = app.isPackaged
    ? join(process.resourcesPath, 'app.asar')
    : here;
  return join(base, ...parts);
}

function wireWebContentsSecurityHooks() {
  // Set <webview> preload, tighten prefs, and route window.open to shell.openExternal
  app.on('web-contents-created', (_event, contents: WebContents) => {
    // Give webviews our preload so they can talk to the host using sendToHost
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      webPreferences.preload = resolveResource('windows', 'webview-preload.js'); // runs inside guest
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = false;
      webPreferences.nodeIntegration = false;
      // optional: restrict permissions, verify URL, etc.
      log('will-attach-webview → preload', webPreferences.preload, 'src=', params.src);
    });

    // Make target=_blank etc. open externally
    // (Electron docs now prefer setWindowOpenHandler over new-window) 
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url); // open in user’s default browser
      return { action: 'deny' };
    });
  });
}

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
    show: true,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // we host the Library in a <webview>
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      log('ready-to-show → show()');
    }
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      log('force show after timeout');
    }
  }, 1500);

  mainWindow.webContents.on('did-finish-load', () => log('did-finish-load'));
  mainWindow.on('unresponsive', () => log('renderer unresponsive'));

  // Open any navigations to http/https externally if they somehow hit the host page
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!/^file:/i.test(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  try {
    if (!existsSync(libraryHtml)) throw new Error('library.html not found');
    log('loading file', libraryHtml);
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

  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupSingleInstance() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      log('second-instance → focused existing window');
    }
  });
}

function registerShortcuts() {
  // Toggle overlay panel (renderer listens for this event)
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow) mainWindow.webContents.send('overlay:panel/toggle');
  });
  // Clear all stickers/overlays
  globalShortcut.register('CommandOrControl+Shift+Backspace', () => {
    ipcMain.emit('overlay:clearAll-request');
  });
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  try { mkdirSync(userData, { recursive: true }); } catch {}
  appLogPath = join(userData, 'icon-desktop.log');
  log('userData', userData);

  wireWebContentsSecurityHooks();
  setupSingleInstance();

  // IPC for overlays + “open external”
  registerOverlayIpc(log);
  ipcMain.handle('app/openExternal', async (_e, url: string) => {
    try { await shell.openExternal(url); } catch (err) { log('openExternal error', String(err)); }
  });

  registerShortcuts();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
