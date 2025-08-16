import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'web',      use: { ...devices['Desktop Chrome'] } },
    {
      name: 'extension',
      use: {
        channel: 'chrome',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('dist/extension')}`,
            `--load-extension=${path.resolve('dist/extension')}`
          ]
        }
      }
    },
    {
      name: 'desktop',
      metadata: { electron: true },
      use: { electron: { args: ['app/desktop/main.js'] } } // Playwright _electron :contentReference[oaicite:6]{index=6}
    }
  ]
});
