import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';

import { resolveBuiltExtensionPath } from './extension-path';

interface ChromiumExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  page: Page;
}

export const test = base.extend<ChromiumExtensionFixtures>({
  context: async ({ browserName: _browserName }, use) => {
    const extensionPath = await resolveBuiltExtensionPath();
    const userDataDir = await mkdtemp(join(tmpdir(), 'skeeditor-chromium-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
