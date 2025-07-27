import { execSync } from 'child_process';
import { Shopify } from '@shopify/shopify-api';

(async () => {
  // 1. Build all packages
  execSync('pnpm build', { stdio: 'inherit' });

  // 2. Upload new sticker images to Shopify Files API
  const shopify = new Shopify({
    apiKey: process.env.SHOPIFY_ADMIN_KEY!,
    apiSecretKey: process.env.SHOPIFY_ADMIN_SECRET!,
    scopes: ['write_files', 'write_products'],
    shop: process.env.SHOPIFY_SHOP!,
    apiVersion: '2024-07'
  });

  // … iterate packages/stickers/*/*.webp and shopify.rest.File.create …

  // 3. Update or create products from product_catalog.csv

  // 4. Create GitHub Release & attach installers / zip
})();
