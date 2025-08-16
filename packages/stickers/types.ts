/**
 * Pure data representation of one sticker as it exists in
 *  ▸  packages/stickers/index.json
 *  ▸  the Firebase collection                               */
export interface StickerEntry {
  /** primary key (hash) – unique across all tiers */
  id: string;
  /** human‑readable name shown in UI                 */
  name: string;
  /** file name under /stickers/ (png / webp / gif)   */
  file: string;
  /** pixel dimensions of the *original* asset        */
  width: number;
  height: number;
  /** animated = true → show a <video> / <img src="…gif">   */
  animated: boolean;

  /** 0 – 1 relative default position on the screen */
  defaultPosition: { x: number; y: number };

  /** square 128 px preview used in picker            */
  thumb: string;

  /** how “viral” this sticker is (drives sorting)    */
  viralityTier: 1 | 2 | 3 | 4;

  /** MSRP in US‑$, used by the store‑front            */
  priceUSD: number;
}

/* ------------------------------------------------------------------ */
/*  In most places the code only needs “any sticker”.                  */
/*  Re‑exporting under a shorter alias keeps imports nice & short.     */
export type Sticker = StickerEntry;
