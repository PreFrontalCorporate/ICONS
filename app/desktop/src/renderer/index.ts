import StickerCanvas from '../../../components/StickerCanvas';
import { verify } from 'electron';

(async () => {
  const token = localStorage.getItem('multipass');
  const allowedIds: string[] = token ? await window.api.verify(token) : [];
  const manifest = (await import('../../../packages/stickers/index.json')).default;
  StickerCanvas({ stickers: manifest.filter((s) => allowedIds.includes(s.id)) });
})();
