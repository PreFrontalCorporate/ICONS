const assert = require('assert');
const { JSDOM } = require('jsdom');
const Module = require('module');

// Mock Electron's ipcRenderer and contextBridge
const mockIpcRenderer = {
  sendToHost: (channel, payload) => {
    mockIpcRenderer.sentMessages.push({ channel, payload });
  },
  sentMessages: [],
};

const mockContextBridge = {
  exposeInMainWorld: (apiKey, api) => {
    dom.window[apiKey] = api;
  },
};

// Intercept require('electron') and return our mock
const originalRequire = Module.prototype.require;
Module.prototype.require = function(module) {
  if (module === 'electron') {
    return {
      contextBridge: mockContextBridge,
      ipcRenderer: mockIpcRenderer,
    };
  }
  return originalRequire.apply(this, arguments);
};

// HTML content for the test
const html = `
<!DOCTYPE html>
<html>
<body>
  <img id="sticker" src="https://example.com/sticker.png" />
</body>
</html>
`;

// Create a JSDOM environment
const dom = new JSDOM(html, {
  url: 'https://example.com',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;

// Load the webview-preload.js script
require('../windows/webview-preload');

// Manually attach the click listener
dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

// Clear the initial 'webview-ready' message
mockIpcRenderer.sentMessages = [];

// --- Test Execution ---

// 1. Simulate a single click
const stickerImage = dom.window.document.getElementById('sticker');
const clickEvent = new dom.window.MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  button: 0, // Left click
});
stickerImage.dispatchEvent(clickEvent);

// 2. Assertions
assert.strictEqual(mockIpcRenderer.sentMessages.length, 1, 'Expected exactly one IPC message.');
const [message] = mockIpcRenderer.sentMessages;
assert.strictEqual(message.channel, 'icon:webview-sticker', 'IPC channel should be "icon:webview-sticker".');
assert.deepStrictEqual(message.payload, { src: 'https://example.com/sticker.png' }, 'Payload should contain the correct sticker URL.');

console.log('Smoke test passed!');
