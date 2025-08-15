import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
import * as path from 'node:path';

let mainWin: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

// GOAL:main.single_overlay
function getOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    frame: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Overlay needs to live outside sandbox for some syscalls
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, '../overlay/index.html'));
  overlayWindow.on('closed', () => { overlayWindow = null; });

  return overlayWindow;
}

function sendToOverlay(channel: string, ...args: any[]) {
  getOverlayWindow()?.webContents.send(channel, ...args);
}

async function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // Start hidden, show when ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    },
  });

  mainWin.loadFile(path.join(__dirname, '../windows/library.html'));

  // More robust show logic
  mainWin.once('ready-to-show', () => {
    if (mainWin) {
      mainWin.show();
    }
  });

  mainWin.on('closed', () => { mainWin = null; });

  // Forward events from the main window (hosting the webview) to the overlay
  ipcMain.on('icon:webview-sticker', (_event, arg) => {
    sendToOverlay('sticker:add', arg);
  });
}

function registerGlobalShortcuts() {
  const mapping = {
    'CommandOrControl+Shift+O': () => sendToOverlay('overlay:toggle'),
    'CommandOrControl+Shift+0': () => sendToOverlay('overlay:toggle'),
    'CommandOrControl+Shift+Backspace': () => sendToOverlay('overlay:nuke'),
    'CommandOrControl+Alt+M': () => sendToOverlay('overlay:nuke'),
    'CommandOrControl+Alt+H': () => sendToOverlay('overlay:toggleHide'),
    'CommandOrControl+Alt+S': () => sendToOverlay('overlay:shuffle'),
    'CommandOrControl+Alt+R': () => sendToOverlay('overlay:rain', 30),
    'CommandOrControl+Alt+1': () => sendToOverlay('overlay:mix', 'A'),
    'CommandOrControl+Alt+2': () => sendToOverlay('overlay:mix', 'B'),
    'CommandOrControl+Alt+3': () => sendToOverlay('overlay:mix', 'C'),
  };

  for (const [accelerator, action] of Object.entries(mapping)) {
    try {
      globalShortcut.register(accelerator, action);
    } catch (e) {
      console.error(`Failed to register shortcut ${accelerator}:`, e);
    }
  }
}

app.whenReady().then(() => {
  createMainWindow();
  getOverlayWindow(); // Pre-warm the overlay
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC from preload scripts
ipcMain.on('app:open-external', (_event, url) => {
  shell.openExternal(url);
});
