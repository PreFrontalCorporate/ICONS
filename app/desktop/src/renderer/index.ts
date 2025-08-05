// app/desktop/src/renderer/index.ts
import StickerCanvas from '@components/StickerCanvas';
import { verify } from 'jsonwebtoken';
import stickers from '@stickers/index.json';

declare global {
  interface Window {
    api: { ping(): Promise<string> };
  }
}

(async () => {
  console.log('Renderer booted, sticker count:', stickers.length);
  console.log('ping →', await window.api.ping());

  // quick JWT sanity‑check
  const token = verify('dummy.jwt.token', 'secret', { ignoreExpiration: true });
  console.log(token);
})();
