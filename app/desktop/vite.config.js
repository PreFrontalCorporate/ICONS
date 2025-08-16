"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vite_1 = require("vite");
var node_path_1 = require("node:path");
exports.default = (0, vite_1.defineConfig)({
    // Vite expects index.html in this folder
    root: __dirname,
    base: './',
    build: {
        // IMPORTANT: put renderer output INSIDE app/desktop/dist so it ships with the app
        outDir: (0, node_path_1.resolve)(__dirname, 'dist/renderer'),
        emptyOutDir: true
    }
});
