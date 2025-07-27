chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RENDER' && Array.isArray(msg.stickers)) {
    // Same DOM injection as the PWA
  }
});
