import { useEffect } from 'react';
import type { StickerEntry } from '@stickers/types';   // ← only StickerEntry is needed

export default function StickerCanvas({ stickers }: { stickers: StickerEntry[] }) {
  useEffect(() => {
    stickers.forEach((s) => {
      const img = document.createElement('img');
      img.src = `/stickers/${s.file}`;

      img.dataset.sticker = s.id;          // gives us a handle for cleanup
      img.style.position = 'fixed';
      img.style.left   = `${s.defaultPosition.x * 100}%`;
      img.style.top    = `${s.defaultPosition.y * 100}%`;
      img.style.transform      = 'translate(-50%,-50%)';
      img.style.pointerEvents  = 'none';
      img.width = s.width;

      document.body.appendChild(img);
    });

    return () => {
      document.querySelectorAll<HTMLImageElement>('img[data-sticker]')
        .forEach((n) => n.remove());
    };
  }, [stickers]);

  return null; /** purely side‑effect component */
}
