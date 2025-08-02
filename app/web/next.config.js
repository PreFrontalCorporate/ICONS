// app/web/next.config.js   (ES‑module style)

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nextConfig = {
  /**
   * Allow hot‑reloading from any of these origins while running
   * `next dev -H 0.0.0.0 -p 3000`
   */
  allowedDevOrigins: [
    'http://34.134.149.61:3000',  // VM external IP
    'http://34.134.149.61',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],

  reactStrictMode: true,

  /**
   * Replicate the tsconfig “@/*” alias for Webpack so that
   *   import Button from '@/components/ui/button';
   * works everywhere.
   */
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(
      path.dirname(fileURLToPath(import.meta.url))
    );
    return config;
  },
};

export default nextConfig;

