// app/web/next.config.js  – ES‑module style
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  /* —–––––––– Dev CORS –––––––– */
  allowedDevOrigins: [
    'http://34.134.149.61:3000',   // VM external IP
    'http://34.134.149.61',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],

  reactStrictMode: true,

  /* --- ✨ produce .next/standalone/ for Docker / Cloud Run --- */
  output: 'standalone',

  /* —–––––––– Webpack aliases –––––––– */
  webpack(config) {
    // “@/…” → workspace root (src, components, styles, …)
    config.resolve.alias['@'] = rootDir;

    // stub Shopify libs (not needed on the public site)
    const emptyStub = path.join(rootDir, 'mocks/empty.js');
    config.resolve.alias['@shopify/multipass']  = emptyStub;
    config.resolve.alias['@shopify/shopify-api'] = emptyStub;

    // optional import from the monorepo packages/
    config.resolve.alias['@/packages'] = path.resolve(rootDir, '../../packages');

    return config;
  },
};

export default nextConfig;
