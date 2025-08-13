
const assert = require('assert');
const { JSDOM } = require('jsdom');
const Module = require('module');

// Mock Electron's ipcRenderer and contextBridge
const mockElectron = {
  ipcRenderer: {
    sendToHost: (channel, payload) => {
      console.log(`ipcRenderer.sendToHost called with:`, channel, payload);
      global.ipcEvents.push({ channel, payload });
    }
  },
  contextBridge: {
    exposeInMainWorld: (apiKey, api) => {
      // Do nothing, as we are not testing the bridge itself
    }
  }
};

// Global state to track IPC calls
global.ipcEvents = [];

// High-level mock for the electron module
const originalRequire = Module.prototype.require;
Module.prototype.require = function(module) {
  if (module === 'electron') {
    return mockElectron;
  }
  return originalRequire.apply(this, arguments);
};

// JSDOM setup
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <img id="sticker" src="https://example.com/sticker.png" />
</body>
</html>
`, {
  url: "https://example.com",
  runScripts: "dangerously", // Allow scripts to run
});

// Inject the preload script into the JSDOM environment
global.window = dom.window;
global.document = dom.window.document;
const preload = require('../windows/webview-preload.js');

// Simulate a click
const stickerElement = dom.window.document.getElementById('sticker');
const clickEvent = new dom.window.MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  button: 0
});
stickerElement.dispatchEvent(clickEvent);

// Assertions
const stickerEvents = global.ipcEvents.filter(e => e.channel === 'icon:webview-sticker');
assert.strictEqual(stickerEvents.length, 1, 'Expected exactly one IPC event');
assert.strictEqual(stickerEvents[0].channel, 'icon:webview-sticker', 'Expected channel to be "icon:webview-sticker"');
assert.deepStrictEqual(stickerEvents[0].payload, { src: 'https://example.com/sticker.png' }, 'Expected payload to be correct');

console.log('Smoke test passed!');
