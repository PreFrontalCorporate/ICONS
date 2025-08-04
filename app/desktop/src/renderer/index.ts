import StickerCanvas from '../../components/StickerCanvas';   // fixed path
import { verify } from 'jsonwebtoken';
import stickers from '@stickers/index.json';                  // json import works because tsconfig has resolveJsonModule

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
