
// app/desktop/scripts/smoke-sticker-bridge.js

const { JSDOM } = require('jsdom');
const { readFileSync } = require('fs');
const path = require('path');
const assert = require('assert');
const sinon = require('sinon');

// --- Setup ---
// Read the preload script
const preloadPath = path.resolve(__dirname, '../windows/webview-preload.js');
const preloadCode = readFileSync(preloadPath, 'utf8');

// --- Test ---
async function runTest() {
  console.log('Smoke Test: Running sticker bridge test...');

  const clock = sinon.useFakeTimers();

  // 1. Create a JSDOM environment
  const dom = new JSDOM(`<!DOCTYPE html><body><img src="test.png" /></body>`, {
    url: 'https://icon-web-two.vercel.app/library',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Date = Date; // Pass the faked Date object to the window
    }
  });

  // 2. Prepare the environment to mimic Electron's webview
  const ipcRendererMock = {
    sendToHost: sinon.spy(),
  };

  const contextBridgeMock = {
    exposeInMainWorld: (apiKey, api) => {
      dom.window[apiKey] = api;
    },
  };

  dom.window.require = (module) => {
    if (module === 'electron') {
      return {
        ipcRenderer: ipcRendererMock,
        contextBridge: contextBridgeMock,
      };
    }
    return require(module);
  };

  // 3. Execute the preload script in the JSDOM context
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = preloadCode;
  dom.window.document.body.appendChild(scriptEl);

  // 4. Simulate a click on the image
  const img = dom.window.document.querySelector('img');
  const clickEvent = new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: dom.window,
    button: 0, // Main button
  });
  img.dispatchEvent(clickEvent);
  img.dispatchEvent(clickEvent); // Fire it twice to simulate the buggy behavior

  // 5. Assertions
  // Even if the event fires twice, the throttle should prevent more than one call.
  assert.strictEqual(ipcRendererMock.sendToHost.callCount, 1, 'sendToHost should be called only once');

  // 6. Test throttling
  await clock.tickAsync(301);
  img.dispatchEvent(clickEvent);
  assert.strictEqual(ipcRendererMock.sendToHost.callCount, 2, 'sendToHost should be called again after throttle');


  console.log('Smoke Test: Sticker bridge test passed!');
  clock.restore();
}

runTest().catch((err) => {
  console.error('Smoke Test: FAILED', err);
  process.exit(1);
});
