document.getElementById('save')!.addEventListener('click', async () => {
  const token = (document.getElementById('token') as HTMLInputElement).value;
  chrome.runtime.sendMessage({ type: 'VERIFY', token }, (resp) => {
    if (resp?.allowedIds) {
      localStorage.setItem('multipass', token);
      (document.getElementById('status') as HTMLElement).textContent =
        `✔ ${resp.allowedIds.length} stickers unlocked`;
    } else {
      (document.getElementById('status') as HTMLElement).textContent =
        '❌ Verification failed';
    }
  });
});
