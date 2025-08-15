
const assert = require('assert');
const { JSDOM } = require('jsdom');

// --- Test Setup ---
const dom = new JSDOM(`<!DOCTYPE html>
  <body>
    <img id="sticker" src="https://example.com/sticker.png" />
    <div id="not-a-sticker">Click me</div>
  </body>
`);

global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle;
global.Element = dom.window.Element;

// Mock Electron's IPC APIs
const mockIpcRenderer = {
  _sends: [],
  sendToHost(channel, payload) {
    this._sends.push({ channel, payload });
  },
  _clear() {
    this._sends = [];
  },
  _getSends() {
    return this._sends;
  }
};

global.require = (module) => {
  if (module === 'electron') {
    return {
      contextBridge: {
        exposeInMainWorld: (apiKey, api) => {
          global.window[apiKey] = api;
        }
      },
      ipcRenderer: mockIpcRenderer,
    };
  }
  return {};
};

// --- Load the script under test ---
require('../windows/webview-preload.js');

// --- Test Cases ---
async function runTest() {
  console.log('Running smoke test for sticker bridge...');

  // Test 1: A single click on an image should send exactly one IPC message.
  mockIpcRenderer._clear();
  window.icon._reset(); // Reset throttle

  const stickerEl = document.getElementById('sticker');
  stickerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));

  assert.strictEqual(mockIpcRenderer._getSends().length, 1, 'Test 1 Failed: Expected 1 IPC message after one click.');
  assert.strictEqual(mockIpcRenderer._getSends()[0].channel, 'icon:webview-sticker', 'Test 1 Failed: Wrong channel.');
  assert.deepStrictEqual(mockIpcRenderer._getSends()[0].payload, { src: 'https://example.com/sticker.png' }, 'Test 1 Failed: Wrong payload.');
  console.log('✔ Test 1 Passed: Single click sent one message.');

  // Test 2: Two rapid clicks should only send one message due to throttling.
  mockIpcRenderer._clear();
  window.icon._reset();

  stickerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));
  stickerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 })); // 2nd click immediately

  assert.strictEqual(mockIpcRenderer._getSends().length, 1, 'Test 2 Failed: Expected 1 IPC message after two rapid clicks.');
  console.log('✔ Test 2 Passed: Throttling prevented duplicate messages.');

  // Test 3: A click on a non-image element should send no messages.
  mockIpcRenderer._clear();
  window.icon._reset();

  const nonStickerEl = document.getElementById('not-a-sticker');
  nonStickerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));

  assert.strictEqual(mockIpcRenderer._getSends().length, 0, 'Test 3 Failed: Expected 0 IPC messages for a non-sticker click.');
  console.log('✔ Test 3 Passed: No message sent for irrelevant clicks.');

  // Test 4: Calling the bridge API directly should send one message.
  mockIpcRenderer._clear();
  window.icon._reset();

  window.icon.addSticker({ src: 'https://example.com/direct.png' });

  assert.strictEqual(mockIpcRenderer._getSends().length, 1, 'Test 4 Failed: Bridge API call did not send a message.');
  assert.strictEqual(mockIpcRenderer._getSends()[0].payload.src, 'https://example.com/direct.png', 'Test 4 Failed: Bridge API sent wrong payload.');
  console.log('✔ Test 4 Passed: Direct API call works.');

  // Test 5: A direct API call followed by a rapid click should only send one message.
  mockIpcRenderer._clear();
  window.icon._reset();

  window.icon.addSticker({ src: 'https://example.com/direct.png' });
  stickerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));

  assert.strictEqual(mockIpcRenderer._getSends().length, 1, 'Test 5 Failed: Throttle did not block click after direct API call.');
  console.log('✔ Test 5 Passed: Throttle correctly blocks click after API call.');

  console.log('\nSmoke test passed successfully! ✅');
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
