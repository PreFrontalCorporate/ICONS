// app/web/pages/download.tsx
import { Button } from '@/components/ui/button';

export default function Download() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-10">
      <h1 className="text-3xl font-bold">💻 Desktop build</h1>

      <p className="text-center text-muted-foreground max-w-md">
        The Electron package is not published yet. Until the first GitHub
        release is available this page will stay as a placeholder.
      </p>

      {/* later: replace href with the real AppImage/DMG/NSIS URL */}
      <Button asChild>
        <a
          href="https://github.com/PreFrontalCorporate/icon/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Go to releases ↗︎
        </a>
      </Button>
    </main>
  );
}
