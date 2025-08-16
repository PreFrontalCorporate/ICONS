const token = localStorage.getItem('multipass');
chrome.runtime.sendMessage({ type: 'VERIFY', token }, (resp) => {
  if (!resp) return;
  resp.allowedIds.forEach((id: string) => {
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(`stickers/${id}.webp`);
    img.style.position = 'fixed';
    img.style.pointerEvents = 'none';
    document.body.appendChild(img);
  });
});
