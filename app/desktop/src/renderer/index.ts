declare global {
  interface Window { api: { verifyJWT(token: string): any } }
}

import StickerCanvas from '@components/StickerCanvas';
import type { StickerEntry } from '@stickers/types';

(async () => {
  const token = location.hash.slice(1);          // #<JWT>
  if (!token) {
    document.body.textContent = 'Please log in…';
    return;
  }

  try {
    const user = await window.api.verifyJWT(token);
    console.log('User verified:', user);

    // fetch sticker list from backend (placeholder)
    const stickers: StickerEntry[] = [];

    StickerCanvas({ stickers });
  } catch (err) {
    console.error(err);
    document.body.textContent = 'Invalid login.';
  }
})();
