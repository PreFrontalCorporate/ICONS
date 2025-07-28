import { test, expect } from '@playwright/test';

test('purchase flow licences sticker', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // …your checkout mocks here…
  await page.reload();
  await expect(page.locator('[data-owned="sticker-123"]')).toBeVisible();
});
