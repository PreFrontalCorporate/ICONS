"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('iconOverlay', {
    pinSticker: function (id, url) { return electron_1.ipcRenderer.invoke('overlay:create', id, url); },
    clearAll: function () { return electron_1.ipcRenderer.invoke('overlay:clearAll'); }
});
