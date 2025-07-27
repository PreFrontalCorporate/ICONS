chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'VERIFY') {
    const r = await fetch('https://icon.cbb.homes/api/verify', {
      method: 'POST',
      body: JSON.stringify({ token: msg.token }),
      headers: { 'Content-Type': 'application/json' }
    });
    sendResponse(await r.json());
  }
  return true; // keep port open
});
