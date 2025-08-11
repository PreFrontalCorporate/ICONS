"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOverlay = createOverlay;
exports.removeAllOverlays = removeAllOverlays;
// app/desktop/src/ipc/overlay.ts
var electron_1 = require("electron");
var node_path_1 = require("node:path");
var ACTIVE = new Map();
/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
function createOverlay(id, imgUrl) {
    if (ACTIVE.has(id)) {
        ACTIVE.get(id).show();
        return;
    }
    var cursor = electron_1.screen.getCursorScreenPoint();
    var disp = electron_1.screen.getDisplayNearestPoint(cursor);
    var win = new electron_1.BrowserWindow({
        width: 320, height: 320,
        x: disp.bounds.x + Math.round(disp.workArea.width / 3),
        y: disp.bounds.y + Math.round(disp.workArea.height / 3),
        transparent: true,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        type: 'toolbar',
        webPreferences: {
            // IMPORTANT: our preload is CJS at runtime
            preload: node_path_1.default.join(__dirname, '../preload.cjs'),
            sandbox: false,
        }
    });
    if (process.platform === 'win32') {
        // Sit above most fullscreen windows on Windows
        win.setAlwaysOnTop(true, 'pop-up-menu');
    }
    win.loadURL("data:text/html,\n    <meta http-equiv=\"Content-Security-Policy\" content=\"img-src * data: blob:;\">\n    <style>\n      html,body{margin:0;background:transparent;overflow:hidden}\n      img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}\n    </style>\n    <script>\n      // Allow ESC to close the overlay\n      window.addEventListener('keydown', e => e.key === 'Escape' && window.close());\n    </script>\n    <img src=\"".concat(encodeURI(imgUrl), "\">\n  "));
    win.on('closed', function () { return ACTIVE.delete(id); });
    ACTIVE.set(id, win);
}
function removeAllOverlays() {
    ACTIVE.forEach(function (w) { return w.close(); });
    ACTIVE.clear();
}
