/* scripts/smoke-sticker-bridge.js (pinned) */
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// --- stub minimal DOM + window ---
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!doctype html><html><body><img id="st" src="https://icon-web-two.vercel.app/test.png"/></body></html>`, {
  url: "https://icon-web-two.vercel.app/"
});
global.window = dom.window;
global.document = dom.window.document;

// --- stub electron bridge ---
const events = [];
const ipcRenderer = {
  sendToHost: (channel, payload) => {
    console.log("ipcRenderer.sendToHost called with:", channel, payload);
    events.push([channel, payload]);
  }
};
const contextBridge = {
  exposeInMainWorld: (name, bridge) => {
    global[name] = bridge;
  }
};
// make require('electron') return the stubs
const Module = require('node:module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return { ipcRenderer, contextBridge };
  return origLoad.apply(this, arguments);
};

// --- load preload script in a VM ---
const preloadPath = path.join(__dirname, '..', 'windows', 'webview-preload.js');
const code = fs.readFileSync(preloadPath, 'utf8');
const sandbox = {
  console, require, module, __filename, __dirname,
  window: global.window, document: global.document
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// one ready + one sticker
console.log("Running smoke test...");
const ready = events.filter(e => e[0] === 'icon:webview-ready').length;
assert.strictEqual(ready, 1, "expected one ready");

const img = document.getElementById('st');
const click = new dom.window.MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
img.dispatchEvent(click);

const stickers = events.filter(e => e[0] === 'icon:webview-sticker').length;
assert.strictEqual(stickers, 1, "expected one sticker");

console.log("✅ smoke passed");
