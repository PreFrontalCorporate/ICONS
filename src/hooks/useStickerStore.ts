import create from 'zustand';
import type { StickerEntry } from '../../packages/stickers/types';

interface State {
  allowed: Set<string>;
  library: StickerEntry[];
  load: (token: string | null) => Promise<void>;
}

export const useStickerStore = create<State>((set) => ({
  allowed: new Set(),
  library: [],
  load: async (token) => {
    const { allowedIds, manifestHash } =
      token ? await verifyPurchase(token) : { allowedIds: [], manifestHash: '' };

    // Integrity check (simple SHA‑256 over concatenated file hashes)
    const localHash = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(window.__STICKER_MANIFEST_HASH__)
    );
    if (
      Buffer.from(localHash).toString('hex') !== manifestHash &&
      process.env.NODE_ENV === 'production'
    )
      throw new Error('Manifest tampered');

    const manifest = (await import('../../packages/stickers/index.json')).default;
    set({ allowed: new Set(allowedIds), library: manifest });
  }
}));
