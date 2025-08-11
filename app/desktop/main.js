"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var node_path_1 = require("node:path");
var overlay = require("./ipc/overlay");
var mainWin;
function createMainWindow() {
    mainWin = new electron_1.BrowserWindow({
        width: 1024, height: 720, minWidth: 800, minHeight: 600,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            sandbox: false
        }
    });
    mainWin.setMenu(buildMenu());
    mainWin.loadFile(node_path_1.default.join(__dirname, '../windows/library.html'));
    // show onboarding once
    if (electron_1.app.getVersion().endsWith('.0')) {
        electron_1.dialog.showMessageBox(mainWin, {
            type: 'info',
            title: 'icon',
            message: 'Tip:  Ctrl + Shift + X removes all stickers.\nESC closes a focused overlay.',
        });
    }
}
function buildMenu() {
    return electron_1.Menu.buildFromTemplate([
        { role: 'fileMenu', submenu: [
                { label: 'Clear all stickers', accelerator: 'Ctrl+Shift+X', click: overlay.removeAllOverlays },
                { type: 'separator' }, { role: 'quit' }
            ] }
    ]);
}
electron_1.app.whenReady().then(function () {
    createMainWindow();
    electron_1.globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
});
electron_1.app.on('window-all-closed', function () { return process.platform !== 'darwin' && electron_1.app.quit(); });
/* ───── IPC ────────────────────────────────────────────── */
electron_1.ipcMain.handle('overlay:create', function (_e, id, url) { return overlay.createOverlay(id, url); });
electron_1.ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);
