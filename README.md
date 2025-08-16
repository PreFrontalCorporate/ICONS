## Getting Started (WSL 2)

1. **Clone & install**

```bash
git clone git@github.com:prefrontalcorporate/icon.git ~/icon
cd ~/icon && pnpm i
Fix WSL permissions

bash
Copy
Edit
sudo chown -R $USER:$USER ~/icon ~/.local/share/pnpm ~/.vscode-server-insiders
Dev targets

bash
Copy
Edit
pnpm dev -F web        # Next 14 PWA  → http://localhost:3000
pnpm dev -F extension  # Chrome / FF extension with HMR
pnpm dev -F desktop    # Electron overlay
End-to-end tests

bash
Copy
Edit
pnpm playwright test   # runs across all three surfaces
Release

bash
Copy
Edit
pnpm run build:catalog   # regenerate sticker manifests & CSV
git tag v0.1.0 && git push --tags   # triggers release workflow
ENV vars required: MULTIPASS_SECRET, STICKERS_KV, CHROME_* (extension publish), GH_TOKEN (Electron release).

pgsql
Copy
Edit

---

### Next actions

1. Paste each file into its path, `git add`, commit, and push.
2. Add the secrets listed in the workflows.
3. Watch the **Actions** tab turn green—then you’re fully CI/CD-enabled.

These code‐ready templates map one-to-one with Shopify, Cloudflare, Electron, Playwright, and GitHub-Actions best-practice examples, so you can drop them in without further boilerplate.
::contentReference[oaicite:10]{index=10}