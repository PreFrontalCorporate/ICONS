import { useEffect } from 'react';
import type { StickerEntry, Sticker } from '@stickers/types';

export default function StickerCanvas({ stickers }: { stickers: StickerEntry[] }) {
  useEffect(() => {
    // Dynamically create <img> nodes – overlay absolute‑positioned
    stickers.forEach((s) => {
      const img = document.createElement('img');
      img.src = `/stickers/${s.file}`;
      img.style.position = 'fixed';
      img.style.left = `${s.defaultPosition.x * 100}%`;
      img.style.top = `${s.defaultPosition.y * 100}%`;
      img.style.transform = 'translate(-50%,-50%)';
      img.style.pointerEvents = 'none';
      img.width = s.width;
      img.setAttribute('data-sticker', s.id);  
      document.body.appendChild(img);
    });
    return () => document.querySelectorAll('img[data-sticker]').forEach((n) => n.remove());
  }, [stickers]);

  return null;
}
