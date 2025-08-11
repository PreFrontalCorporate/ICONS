import { BrowserWindow, ipcMain } from 'electron';

let overlay: BrowserWindow | null = null;
let editMode = false;
let clickThrough = true;
let scale = 1;

function ensureOverlay(parent?: BrowserWindow) {
  if (overlay && !overlay.isDestroyed()) return overlay;

  overlay = new BrowserWindow({
    width: Math.round(600 * scale),
    height: Math.round(400 * scale),
    transparent: true,
    frame: false,
    resizable: true,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,              // becomes false when clickThrough true
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  overlay.setIgnoreMouseEvents(clickThrough && !editMode, { forward: true });
  if (parent) overlay.setParentWindow(parent);
  overlay.loadURL('about:blank'); // your sticker canvas attaches here at runtime
  return overlay;
}

export function registerOverlay(parent?: BrowserWindow) {
  ensureOverlay(parent);

  ipcMain.handle('overlay:toggle', () => {
    if (!overlay || overlay.isDestroyed()) overlay = ensureOverlay(parent);
    if (overlay.isVisible()) overlay.hide(); else overlay.show();
  });

  ipcMain.handle('overlay:setEditMode', (_e, on: boolean) => {
    editMode = !!on;
    if (!overlay) return;
    overlay.setIgnoreMouseEvents(clickThrough && !editMode, { forward: true });
    overlay.setFocusable(editMode);
  });

  ipcMain.handle('overlay:setClickThrough', (_e, on: boolean) => {
    clickThrough = !!on;
    if (!overlay) return;
    overlay.setIgnoreMouseEvents(clickThrough && !editMode, { forward: true });
    overlay.setFocusable(editMode);
  });

  ipcMain.handle('overlay:setScale', (_e, s: number) => {
    scale = Math.max(0.5, Math.min(3, Number(s) || 1));
    if (!overlay) return;
    const [w, h] = overlay.getSize();
    overlay.setSize(Math.round(w * scale), Math.round(h * scale));
  });

  return overlay;
}
