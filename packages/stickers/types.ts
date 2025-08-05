/** One row in our JSON catalogue (`packages/stickers/index.json`). */
export interface StickerEntry {
  /** Stable identifier – also the PNG / APNG filename without extension. */
  id: string;
  /** Human‑friendly name shown in the picker UI. */
  name: string;
  /** File name (relative to the “stickers” folder). */
  file: string;
  /** Intrinsic bitmap size in pixels. */
  width: number;
  height: number;
  /** `true` ⇢ APNG;  `false` ⇢ static PNG. */
  animated: boolean;
  /** Percentage‑based default screen position (0 – 1). */
  defaultPosition: { x: number; y: number };
  /** 128 px square thumbnail for the picker. */
  thumb: string;
  /** Viral‑tier used for “trending” sort order. */
  viralityTier: 1 | 2 | 3 | 4;
  /** Retail price in US cents. */
  priceUSD: number;
}

/**
 * In memory, after we fetch user‑specific metadata,
 * an entry may be enriched with extra flags
 * (e.g. “owned”, “in‑cart”, etc.).  Keep it future‑proof
 * by describing a *superset* of `StickerEntry`.
 */
export type Sticker = StickerEntry & {
  owned?: boolean;
  inCart?: boolean;
  /* add other optional fields here */
};

