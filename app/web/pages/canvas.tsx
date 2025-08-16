// app/web/pages/canvas.tsx
import dynamic from 'next/dynamic';
const StickerCanvas = dynamic(() => import('@/components/StickerCanvas'), {
  ssr: false,
});

export default function CanvasPage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <StickerCanvas />
    </div>
  );
}
