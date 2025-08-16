'use client';
import { useStickerStore } from '@/hooks/useStickerStore';
import StickerCanvas from '@/components/StickerCanvas';

export default function Home() {
  const { library, allowed } = useStickerStore();

  return (
    <main className="h-screen w-screen overflow-hidden">
      <StickerCanvas stickers={library.filter((s) => allowed.has(s.id))} />
    </main>
  );
}
