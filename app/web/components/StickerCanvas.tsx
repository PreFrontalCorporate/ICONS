// app/web/components/StickerCanvas.tsx
'use client';

import { useState } from 'react';
import { Button }     from '@/components/ui/button';

export default function StickerCanvas() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4 p-10">
      <h2 className="text-2xl font-semibold">🖼️ Canvas placeholder</h2>
      <p className="text-muted-foreground">
        Clicks: <b>{count}</b>
      </p>
      <Button onClick={() => setCount(c => c + 1)}>Try me</Button>
    </div>
  );
}
