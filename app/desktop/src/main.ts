import { app, BrowserWindow, ipcMain, globalShortcut } from "electron";
import path from "node:path";

const overlays = new Set<BrowserWindow>();

function createOverlay({
  src,
  name = "",
  w = 320,
  h = 320,
  rotation = 0,
}: { src: string; name?: string; w?: number; h?: number; rotation?: number }) {
  const win = new BrowserWindow({
    width: w,
    height: h,
    frame: false,
    transparent: true,
    resizable: true,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Keep truly on top (above full‑screen windows)
  win.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  overlays.add(win);
  win.on("closed", () => overlays.delete(win));

  win.loadFile(path.join(__dirname, "overlay", "sticker.html"), {
    query: { src, name, rotation: String(rotation) },
  });

  return win;
}

/** IPC plumbing */
ipcMain.on("pin-sticker", (_evt, payload) => createOverlay(payload));
ipcMain.on("clear-overlays", () => {
  overlays.forEach((w) => w.close());
  overlays.clear();
});
ipcMain.handle("overlay-close-self", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle("overlay-resize-self", (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && Number.isFinite(width) && Number.isFinite(height)) {
    win.setSize(Math.round(width), Math.round(height), true);
  }
});

/** Optional macro: Ctrl/Cmd + Alt + X clears all overlays */
app.whenReady().then(() => {
  globalShortcut.register("CommandOrControl+Alt+X", () => {
    overlays.forEach((w) => w.close());
    overlays.clear();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
