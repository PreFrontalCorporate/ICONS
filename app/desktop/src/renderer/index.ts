// Very small placeholder UI for now.
// Vite will bundle this and inject as <script type="module">.
const root = document.createElement('div');
root.style.font = '14px/1.4 system-ui, sans-serif';
root.style.margin = '16px';
root.innerText = 'Please log in…';
document.body.appendChild(root);

// Probe the bridge so we can verify preload loaded correctly.
(async () => {
  try {
    // @ts-expect-error – provided by preload
    const stickers = await window.api.stickers.list();
    console.debug('Stickers available:', stickers);
  } catch (e) {
    console.error('Bridge not available:', e);
  }
})();
