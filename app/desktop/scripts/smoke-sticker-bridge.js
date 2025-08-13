
// app/desktop/scripts/smoke-sticker-bridge.js
const assert = require('assert');
const { JSDOM } = require('jsdom');

// Mock Electron's ipcRenderer
const mockIpcRenderer = {
  sendToHost: () => {},
};

// Track calls to sendToHost
let sendToHostCalls = [];
mockIpcRenderer.sendToHost = (channel, payload) => {
  sendToHostCalls.push({ channel, payload });
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
  runScripts: "dangerously",
  beforeParse(window) {
    // Inject mock ipcRenderer
    window.require = (module) => {
      if (module === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
      }
      return {};
    };
  }
});

// Your preload script content here
const preloadScriptContent = `
const { contextBridge, ipcRenderer } = require('electron');

const sendToHost = (ch, payload) => {
  try { ipcRenderer.sendToHost(ch, payload); } catch {}
};

const forwardSticker = (payload) => {
  const url = payload?.url || payload?.src;
  if (url) sendToHost('icon:webview-sticker', { src: url });
};

const bridge = {
  addSticker: (payload) => forwardSticker(payload || {}),
  clearOverlays: () => sendToHost('icon:webview-clear'),
};
contextBridge.exposeInMainWorld('icon', bridge);
contextBridge.exposeInMainWorld('desktop', bridge);

const extractUrl = (start) => {
  let el = start;
  for (let i = 0; el && i < 8; i++, el = el.parentElement) {
    if (el.tagName === 'IMG' && el.src) return el.src;
    const s = el.querySelector?.('source[srcset]');
    if (s?.srcset) {
      const first = s.srcset.split(',')[0]?.trim().split(' ')[0];
      if (first) return first;
    }
    if (el.tagName === 'A' && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }
    const bg = (el instanceof Element) ? getComputedStyle(el).backgroundImage || '' : '';
    const m = bg.match(/url\([\"']?(.*?)[\"']?\)/i);
    if (m?.[1]) return m[1];
    const d = (el instanceof Element && el.dataset) || {};
    if (d.stickerSrc) return d.stickerSrc;
    if (d.src) return d.src;
    if (d.image) return d.image;
    if (d.img) return d.img;
  }
  return null;
};

let lastClick = 0;
const clickHandler = (ev) => {
  if (ev.button !== 0) return;
  const now = Date.now();
  if (now - lastClick < 300) return;
  lastClick = now;

  const url = extractUrl(ev.target);
  if (!url) return;
  ev.preventDefault();
  ev.stopPropagation();
  sendToHost('icon:webview-sticker', { src: url });
};

window.addEventListener('click', clickHandler, true);
sendToHost('icon:webview-ready', null);
`;

// Run the preload script in the JSDOM context
const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = preloadScriptContent;
dom.window.document.body.appendChild(scriptEl);


// Simulate a click
const stickerImg = dom.window.document.getElementById('sticker');
stickerImg.click();

// Assertions
assert.strictEqual(sendToHostCalls.length, 2, 'sendToHost should be called twice (ready, sticker)');

const stickerCall = sendToHostCalls.find(call => call.channel === 'icon:webview-sticker');
assert.ok(stickerCall, 'A sticker call should have been made');
assert.strictEqual(stickerCall.channel, 'icon:webview-sticker', 'Channel should be icon:webview-sticker');
assert.deepStrictEqual(stickerCall.payload, { src: 'https://example.com/sticker.png' }, 'Payload should be correct');

const readyCall = sendToHostCalls.find(call => call.channel === 'icon:webview-ready');
assert.ok(readyCall, 'A ready call should have been made');

console.log('Smoke test passed!');
