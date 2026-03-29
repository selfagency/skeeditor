/**
 * test/e2e/fixtures/firefox-devnet-extension.ts
 *
 * Playwright fixture for Firefox devnet E2E tests.
 *
 * Extends the base Playwright `test` with the same devnet fixtures as the
 * chromium-devnet variant — `devnetSession`, `devnetPost`, and
 * `routeDevnetBskyApp` — but launches Firefox with the skeeditor extension
 * loaded via a pre-populated Firefox profile.
 *
 * ## Extension loading
 *
 * Firefox does not support `--load-extension` like Chromium. Instead we:
 *   1. Create a temporary Firefox profile directory.
 *   2. Copy `dist/firefox/` into `{profile}/extensions/skeeditor@selfagency.dev/`.
 *   3. Write `user.js` with the permissive prefs required to load unsigned add-ons.
 *   4. Pin the internal moz-extension UUID via the `extensions.webextensions.uuids`
 *      preference so we can navigate to extension pages without discovery.
 *   5. Launch via `firefox.launchPersistentContext(profileDir, { firefoxUserPrefs })`.
 *
 * ## Guard
 *
 * The full Firefox devnet flow is gated behind `FIREFOX_EXTENSION_E2E=1` because
 * it requires a locally installed Firefox Developer Edition and the devnet stack.
 *
 * XRPC calls flow directly from the extension background page to
 * `http://localhost:3000` (the devnet PDS). Requires `http://localhost/*` in the
 * extension manifest `host_permissions`.
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { test as base, expect, firefox, type BrowserContext } from '@playwright/test';

import { createDevnetPost, deleteDevnetPost, type DevnetPost } from './devnet-records';
import { createPdsSession, type PdsSession } from './devnet-session';
import { resolveBuiltExtensionPath } from './extension-path';

export const firefoxDevnetEnabled = process.env['FIREFOX_EXTENSION_E2E'] === '1';

/** Firefox add-on ID as specified in the manifest's gecko.id. */
const FIREFOX_EXTENSION_GECKO_ID = 'skeeditor@selfagency.dev';

/**
 * A fixed moz-extension UUID pre-seeded into the Firefox profile.
 * This lets us navigate to extension pages without UUID discovery at runtime.
 */
const FIREFOX_EXTENSION_UUID = 'e2a7c8f1-3d5b-4a9e-b6c2-8f0d1e2a3b4c';

const MOCK_PAGE_TEMPLATE_PATH = resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html');

interface FirefoxDevnetFixtures {
  /**
   * Alice's PDS session injected into the extension's storage. Valid for the
   * lifetime of the test.
   */
  devnetSession: PdsSession;

  /**
   * A real `app.bsky.feed.post` record owned by Alice. Deleted after each test.
   */
  devnetPost: DevnetPost;

  /**
   * Intercept `https://bsky.app/**` and serve a page embedding the real devnet
   * AT-URI so the content script identifies the post.
   */
  routeDevnetBskyApp: () => Promise<void>;
}

export const skipIfFirefoxDevnetDisabled = (): void => {
  base.skip(!firefoxDevnetEnabled, 'Firefox devnet E2E tests require FIREFOX_EXTENSION_E2E=1 and the devnet stack.');
};

export const test = base.extend<FirefoxDevnetFixtures & { context: BrowserContext }>({
  // Override the context fixture with a Firefox persistent context that has the
  // extension pre-installed via a custom profile directory.
  context: async ({ browserName: _browserName }, use) => {
    if (!firefoxDevnetEnabled) {
      // Skip guard: yield a dummy context so the fixture chain doesn't explode
      // before the individual test's `test.skip()` fires.
      throw new Error(
        'Firefox devnet context created without FIREFOX_EXTENSION_E2E=1. ' +
          'Call skipIfFirefoxDevnetDisabled() at the start of each test.',
      );
    }

    const extensionPath = await resolveBuiltExtensionPath('firefox');
    const profileDir = await mkdtemp(join(tmpdir(), 'skeeditor-firefox-devnet-'));

    try {
      // 1. Copy the unpacked extension into the profile's extensions directory.
      const extensionsDir = join(profileDir, 'extensions');
      await mkdir(extensionsDir, { recursive: true });
      await cp(extensionPath, join(extensionsDir, FIREFOX_EXTENSION_GECKO_ID), { recursive: true });

      // 2. Write user.js to set the required preferences before launch.
      //    `extensions.webextensions.uuids` pins the internal moz-extension UUID
      //    so we can navigate to extension pages without runtime UUID discovery.
      const uuidsJson = JSON.stringify({ [FIREFOX_EXTENSION_GECKO_ID]: FIREFOX_EXTENSION_UUID });
      const userPrefs = [
        `user_pref("xpinstall.signatures.required", false);`,
        `user_pref("extensions.autoDisableScopes", 0);`,
        `user_pref("extensions.enabledScopes", 15);`,
        `user_pref("extensions.webextensions.uuids", ${JSON.stringify(uuidsJson)});`,
      ].join('\n');
      await writeFile(join(profileDir, 'user.js'), userPrefs, 'utf8');

      // 3. Launch Firefox with the pre-populated profile.
      const context = await firefox.launchPersistentContext(profileDir, {
        firefoxUserPrefs: {
          'xpinstall.signatures.required': false,
          'extensions.autoDisableScopes': 0,
          'extensions.enabledScopes': 15,
          'extensions.webextensions.uuids': uuidsJson,
        },
      });

      await use(context);
      await context.close();
    } finally {
      await rm(profileDir, { force: true, recursive: true });
    }
  },

  devnetSession: async ({ context }, use) => {
    const pdsUrl = process.env['DEVNET_PDS_URL'] ?? 'http://localhost:3000';
    const handle = process.env['DEVNET_ALICE_HANDLE'] ?? 'alice.devnet.test';
    const password = process.env['DEVNET_ALICE_PASSWORD'] ?? 'alice-devnet-pass';

    const session = await createPdsSession(handle, password, pdsUrl);

    // Inject the real session into the extension's storage by navigating to the
    // extension popup page (possible because we pinned the UUID in user.js).
    const popupPage = await context.newPage();
    await popupPage.goto(`moz-extension://${FIREFOX_EXTENSION_UUID}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');

    await popupPage.evaluate(
      async ({ did, storedSession, pdsUrls }) => {
        // In Firefox extension pages, both `chrome` and `browser` namespaces are
        // available (the latter provided by webextension-polyfill).
        await chrome.storage.local.set({
          sessions: { [did]: storedSession },
          activeDid: did,
          pdsUrls,
        });
      },
      {
        did: session.did,
        storedSession: {
          did: session.did,
          handle: session.handle,
          accessToken: session.accessJwt,
          refreshToken: session.refreshJwt,
          expiresAt: Date.now() + 3_600_000,
          scope: 'atproto transition:generic',
        },
        pdsUrls: { [session.did]: pdsUrl },
      },
    );
    await popupPage.close();

    await use(session);
  },

  devnetPost: async ({ devnetSession }, use) => {
    const postText = `skeeditor devnet E2E test post ${Date.now()}`;
    const post = await createDevnetPost(devnetSession, postText);

    await use(post);

    // Teardown: best-effort delete of the test post.
    try {
      await deleteDevnetPost(devnetSession, post.did, post.rkey);
    } catch {
      console.warn(`[devnet] cleanup: failed to delete post ${post.rkey}`);
    }
  },

  routeDevnetBskyApp: async ({ context, devnetPost }, use) => {
    await use(async () => {
      const template = await readFile(MOCK_PAGE_TEMPLATE_PATH, 'utf8');

      const html = template
        .replace(/at:\/\/did:plc:testuser00000000000000\/app\.bsky\.feed\.post\/testpost123456/g, devnetPost.uri)
        .replace(/Hello from my own post\. #testing/g, devnetPost.text)
        .replace(
          /at:\/\/did:plc:otheruser0000000000000\/app\.bsky\.feed\.post\/otherpost987654/g,
          `at://did:plc:devnetotheruser000000/app.bsky.feed.post/otherpost_devnet`,
        );

      await context.route('https://bsky.app/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
      );
    });
  },
});

export { expect };
