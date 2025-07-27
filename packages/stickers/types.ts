export interface StickerEntry {
  id: string;
  name: string;
  file: string;
  width: number;
  height: number;
  animated: boolean;
  defaultPosition: { x: number; y: number };
  thumb: string;
  viralityTier: 1 | 2 | 3 | 4;
  priceUSD: number;
}
