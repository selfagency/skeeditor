/**
 * test/e2e/fixtures/firefox-devnet-extension.ts
 *
 * Firefox devnet E2E is intentionally skipped for now.
 *
 * Playwright currently cannot reliably load WebExtensions in Firefox
 * (see https://github.com/microsoft/playwright/issues/7297 and
 * https://github.com/microsoft/playwright/issues/2644).
 *
 * Use web-ext for Firefox validation instead:
 * - pnpm run webext:lint:firefox
 * - pnpm run webext:run:firefox
 */

import { test as base, expect, type BrowserContext } from '@playwright/test';

import { createDevnetPost, deleteDevnetPost, type DevnetPost } from './devnet-records';
import { createPdsSession, type PdsSession } from './devnet-session';

export const firefoxDevnetEnabled = false;

interface FirefoxDevnetFixtures {
  devnetSession: PdsSession;
  devnetPost: DevnetPost;
  routeDevnetBskyApp: () => Promise<void>;
}

export const skipIfFirefoxDevnetDisabled = (): void => {
  base.skip(
    true,
    'Firefox devnet E2E is skipped: Playwright cannot load Firefox WebExtensions yet. ' +
      'Use `pnpm run webext:run:firefox` for Firefox validation.',
  );
};

export const test = base.extend<FirefoxDevnetFixtures & { context: BrowserContext }>({
  context: async ({ browserName: _browserName }, use, testInfo) => {
    testInfo.skip(
      true,
      'Firefox devnet E2E is skipped: Playwright cannot load Firefox WebExtensions yet. ' +
        'See https://github.com/microsoft/playwright/issues/7297',
    );

    await use(null as unknown as BrowserContext);
  },

  devnetSession: async ({ context: _context }, use) => {
    const pdsUrl = process.env['DEVNET_PDS_URL'] ?? 'http://localhost:3000';
    const handle = process.env['DEVNET_ALICE_HANDLE'] ?? 'alice.devnet.test';
    const password = process.env['DEVNET_ALICE_PASSWORD'] ?? 'alice-devnet-pass';

    const session = await createPdsSession(handle, password, pdsUrl);
    await use(session);
  },

  // eslint-disable-next-line no-empty-pattern
  devnetPost: async ({}, use) => {
    const pdsUrl = process.env['DEVNET_PDS_URL'] ?? 'http://localhost:3000';
    const handle = process.env['DEVNET_ALICE_HANDLE'] ?? 'alice.devnet.test';
    const password = process.env['DEVNET_ALICE_PASSWORD'] ?? 'alice-devnet-pass';
    const rawSession = await createPdsSession(handle, password, pdsUrl);
    const postText = `skeeditor devnet E2E test post ${Date.now()}`;
    const post = await createDevnetPost(rawSession, postText);

    await use(post);

    try {
      await deleteDevnetPost(rawSession, post.did, post.rkey);
    } catch {
      // best effort cleanup only
    }
  },

  routeDevnetBskyApp: async ({ context: _context, devnetPost: _devnetPost }, use) => {
    await use(async () => {
      // no-op, unreachable because context fixture always skips
    });
  },
});

export { expect };
