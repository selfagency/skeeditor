/**
 * test/e2e/fixtures/chromium-devnet-extension.ts
 *
 * Playwright fixture for Chrome devnet E2E tests.
 *
 * Extends the base chromium-extension fixture with:
 * - `devnetSession` — authenticates Alice with the devnet PDS and injects the
 *   real JWT + PDS URL into extension storage (no OAuth popup).
 * - `devnetPost` — creates a real post record on the devnet PDS and tears it
 *   down after the test, even on failure.
 * - `routeDevnetBskyApp` — intercepts https://bsky.app/** and serves a mock
 *   page that embeds the real AT-URI so the content script can pick it up.
 *
 * XRPC calls are NOT intercepted; they flow directly from the extension
 * background service worker to http://localhost:3000 (the devnet PDS).
 * This requires `http://localhost/*` in the extension manifest host_permissions.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { test as chromiumBase, expect } from './chromium-extension';
import { createDevnetPost, deleteDevnetPost, type DevnetPost } from './devnet-records';
import { createPdsSession, type PdsSession } from './devnet-session';

const MOCK_PAGE_TEMPLATE_PATH = resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html');

interface DevnetExtensionFixtures {
  /**
   * Alice's PDS session. Automatically injected into chrome.storage.local so the
   * extension regards Alice as authenticated. The session is valid for the lifetime
   * of the test.
   */
  devnetSession: PdsSession;

  /**
   * A real app.bsky.feed.post record owned by Alice on the devnet PDS. Cleaned up
   * after each test via deleteRecord.
   */
  devnetPost: DevnetPost;

  /**
   * Intercept https://bsky.app/** and serve a page that contains the real devnet
   * AT-URI so that the content script identifies the post and injects the Edit button.
   */
  routeDevnetBskyApp: () => Promise<void>;
}

export const test = chromiumBase.extend<DevnetExtensionFixtures>({
  devnetSession: async ({ context, extensionId }, use) => {
    const pdsUrl = process.env['DEVNET_PDS_URL'] ?? 'http://localhost:3000';
    const handle = process.env['DEVNET_ALICE_HANDLE'] ?? 'alice.devnet.test';
    const password = process.env['DEVNET_ALICE_PASSWORD'] ?? 'alice-devnet-pass';

    const session = await createPdsSession(handle, password, pdsUrl);

    // Inject real session + PDS URL into extension storage.
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.evaluate(
      async ({ did, storedSession, pdsUrls }) => {
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

    // Teardown: try to delete the post from the PDS. Best-effort (the test may
    // have already deleted it, or the record may not exist due to a failed create).
    try {
      await deleteDevnetPost(devnetSession, post.did, post.rkey);
    } catch {
      // Non-fatal: test cleanup failure is logged but does not fail the suite.
      console.warn(`[devnet] cleanup: failed to delete post ${post.rkey}`);
    }
  },

  routeDevnetBskyApp: async ({ context, devnetPost }, use) => {
    await use(async () => {
      // Read the mock page template and substitute the real AT-URI so the content
      // script can match the post and inject the Edit button.
      const template = await readFile(MOCK_PAGE_TEMPLATE_PATH, 'utf8');

      // Replace the hardcoded mock AT-URI and other post-specific values with
      // the real devnet values.
      const html = template
        .replace(/at:\/\/did:plc:testuser00000000000000\/app\.bsky\.feed\.post\/testpost123456/g, devnetPost.uri)
        .replace(/Hello from my own post\. #testing/g, devnetPost.text)
        .replace(
          // Replace the other-user AT-URI with a clearly-foreign AT-URI that
          // won't match Alice's DID so no Edit button is injected there.
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
