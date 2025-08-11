import { BrowserWindow, IpcMain } from 'electron';

const overlays = new Set<BrowserWindow>();

function registerOverlayIpc(ipcMain: IpcMain) {
  // Return current count (handy for UI badges if you need them)
  ipcMain.handle('overlay/count', () => overlays.size);

  // Clear all overlay windows
  ipcMain.handle('overlay/clearAll', () => {
    clearAll();
    return overlays.size;
  });
}

// Public API to create and track overlay windows, if/when you spawn them
function add(win: BrowserWindow) {
  overlays.add(win);
  win.on('closed', () => overlays.delete(win));
}

function clearAll() {
  for (const win of overlays) {
    try { win.destroy(); } catch { /* no-op */ }
  }
  overlays.clear();
}

export const overlayManager = { add, clearAll, count: () => overlays.size };
export { registerOverlayIpc };
