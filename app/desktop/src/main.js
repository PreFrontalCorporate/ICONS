"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var node_path_1 = require("node:path");
var node_fs_1 = require("node:fs");
var isDev = !electron_1.app.isPackaged;
function log() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    try {
        var line = "[".concat(new Date().toISOString(), "] ").concat(args.map(function (a) { return String(a); }).join(' '), "\n");
        var logPath = node_path_1.default.join(electron_1.app.getPath('userData'), 'icon-desktop.log');
        node_fs_1.default.appendFileSync(logPath, line);
    }
    catch (_a) { }
    // eslint-disable-next-line no-console
    console.log.apply(console, __spreadArray(['[main]'], args, false));
}
// Robust preload resolution (dev builds have preload.js; packaged build renames to preload.cjs)
function resolvePreload() {
    var dir = __dirname;
    var cjs = node_path_1.default.join(dir, 'preload.cjs');
    var js = node_path_1.default.join(dir, 'preload.js');
    return node_fs_1.default.existsSync(cjs) ? cjs : js;
}
var mainWin = null;
// lazy import to avoid circular import during transpile
var overlay = {
    create: function (id, url) { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.createOverlay(id, url); }); },
    clearAll: function () { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.removeAllOverlays(); }); }
};
function buildMenu() {
    return electron_1.Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'Clear all stickers', accelerator: 'CommandOrControl+Shift+X', click: function () { return overlay.clearAll(); } },
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
                    click: function () { return electron_1.shell.showItemInFolder(node_path_1.default.join(electron_1.app.getPath('userData'), 'icon-desktop.log')); }
                }
            ]
        }
    ]);
}
function createMainWindow() {
    var preloadPath = resolvePreload();
    mainWin = new electron_1.BrowserWindow({
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
    var libraryHtml = node_path_1.default.join(__dirname, '../windows/library.html');
    var fileUrl = "file://".concat(libraryHtml.replace(/\\/g, '/'));
    log('Loading Library:', fileUrl);
    mainWin.loadURL(fileUrl).catch(function (err) { return log('loadURL threw:', (err === null || err === void 0 ? void 0 : err.stack) || String(err)); });
    mainWin.webContents.on('did-fail-load', function (_e, code, desc, url) {
        log('did-fail-load', code, desc, url);
        var html = Buffer.from("\n      <!doctype html><meta charset=\"utf-8\">\n      <title>Icon Desktop - Error</title>\n      <body style=\"font:14px system-ui;padding:24px;background:#111;color:#eee;\">\n        <h1>Icon Desktop</h1>\n        <p>Renderer failed to load.</p>\n        <pre style=\"white-space:pre-wrap;background:#222;padding:12px;border-radius:8px;\">".concat(desc, " (").concat(code, ")\nTried: ").concat(fileUrl, "</pre>\n      </body>"));
        mainWin === null || mainWin === void 0 ? void 0 : mainWin.loadURL('data:text/html;base64,' + html.toString('base64'));
    });
    mainWin.on('ready-to-show', function () { return mainWin === null || mainWin === void 0 ? void 0 : mainWin.show(); });
    mainWin.on('closed', function () { mainWin = null; });
    // Open external links in the OS browser
    mainWin.webContents.setWindowOpenHandler(function (_a) {
        var url = _a.url;
        electron_1.shell.openExternal(url).catch(function () { });
        return { action: 'deny' };
    });
    if (isDev) {
        try {
            mainWin.webContents.openDevTools({ mode: 'detach' });
        }
        catch (_a) { }
    }
}
electron_1.app.whenReady().then(function () {
    createMainWindow();
    // Global hotkey to clear everything fast
    electron_1.globalShortcut.register('CommandOrControl+Shift+X', function () { return overlay.clearAll(); });
}).catch(function (e) { return log('app.whenReady error', e); });
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', function () { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createMainWindow(); });
/* ───────── IPC: overlay control ───────── */
electron_1.ipcMain.handle('overlay:create', function (_e, id, url) { return overlay.create(id, url); });
electron_1.ipcMain.handle('overlay:clearAll', function () { return overlay.clearAll(); });
