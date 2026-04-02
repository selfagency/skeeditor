import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';

import { resolveBuiltExtensionPath } from './extension-path';

interface ChromiumExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  page: Page;
}

interface ChromiumManifest {
  host_permissions?: string[];
}

const E2E_HOST_PERMISSIONS = ['https://bsky.social/*', 'http://localhost/*', 'http://127.0.0.1/*'] as const;

async function prepareExtensionForE2E(sourceExtensionPath: string): Promise<string> {
  const extensionDir = await mkdtemp(join(tmpdir(), 'skeeditor-extension-'));
  await cp(sourceExtensionPath, extensionDir, { recursive: true });

  const manifestPath = join(extensionDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ChromiumManifest;
  const hostPermissions = new Set(manifest.host_permissions ?? []);

  for (const permission of E2E_HOST_PERMISSIONS) {
    hostPermissions.add(permission);
  }

  manifest.host_permissions = [...hostPermissions];
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');

  return extensionDir;
}

export const test = base.extend<ChromiumExtensionFixtures>({
  context: async ({ browserName: _browserName }, use) => {
    const builtExtensionPath = await resolveBuiltExtensionPath();
    const extensionPath = await prepareExtensionForE2E(builtExtensionPath);
    const userDataDir = await mkdtemp(join(tmpdir(), 'skeeditor-chromium-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
    await rm(extensionPath, { force: true, recursive: true });
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
