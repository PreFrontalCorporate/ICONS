// app/web/next.config.js  – ES‑module style
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nextConfig = {
  /** allow open access from the VM’s external IP while in dev */
  allowedDevOrigins: ['http://34.134.149.61:3000'],

  reactStrictMode: true,

  /** replicate the tsconfig “@/*” alias for webpack */
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(
      path.dirname(fileURLToPath(import.meta.url))
    );
    return config;
  },
};

export default nextConfig;

