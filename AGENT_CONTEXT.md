# General Agent Context: Icon Desktop (Electron)

## Project Overview

Icon Desktop is an Electron-based desktop app that embeds a hosted Library UI inside a `<webview>` and allows users to spawn **screen-stickers** — persistent, always-on-top overlay windows — by clicking images in the Library.

---

## Edit Flow in VM

Run these before pasting updated file contents:

```bash
# Update webview preload
rm app/desktop/windows/webview-preload.js
nano app/desktop/windows/webview-preload.js

# Update Library shell
rm app/desktop/windows/library.html
nano app/desktop/windows/library.html

# Host-side updates (only if needed)
rm app/desktop/src/preload.ts
nano app/desktop/src/preload.ts

rm app/desktop/src/main.ts
nano app/desktop/src/main.ts
```

---

## Build & Ship Sequence

Use this after making code changes:

```bash
# build
pnpm --dir app/desktop install
pnpm --dir app/desktop run build
pnpm --dir app/desktop run postbuild
```

```bash
# bump version to next patch based on current repo version
cd app/desktop
npm pkg set version=<NEXT_VERSION>
cd ../..
```

```bash
# commit & push
git add .
git commit -m "fix(desktop): <summary of change>; v<NEXT_VERSION>"
git push origin main
```

```bash
# tag & push tag (avoids GitHub Actions asset name collisions)
git tag -a v<NEXT_VERSION> -m "Desktop v<NEXT_VERSION>"
git push origin v<NEXT_VERSION>
```
