/**
 * test/e2e/fixtures/firefox-devnet-extension.ts
 *
 * Playwright fixture for Firefox devnet E2E tests.
 *
 * Extends the base Playwright `test` with the same devnet fixtures as the
 * chromium-devnet variant — `devnetSession`, `devnetPost`, and
 * `routeDevnetBskyApp` — but launches Firefox with the skeeditor extension
 * loaded via the Firefox Remote Debugging Protocol (RDP).
 *
 * ## Extension loading
 *
 * Firefox 73+ actively removes sideloaded extension directories from the
 * profile's `extensions/` folder on startup (anti-malware protection).  There
 * is no pref that bypasses this.  The only reliable approach for temporary
 * extension loading without AMO is the Firefox Remote Debugging Protocol:
 *
 *   1. Create a temporary Firefox profile directory.
 *   2. Find a free TCP port for the RDP server.
 *   3. Launch Firefox via `firefox.launchPersistentContext` with
 *      `-start-debugger-server <port>` to expose the RDP server and
 *      `firefoxUserPrefs` to allow unsigned add-ons.
 *   4. Connect to the RDP server and send `installTemporaryAddon` with the
 *      path to `dist/firefox/`.
 *   5. Extract the assigned `moz-extension://<uuid>/` base URL from the
 *      RDP response and store it for `devnetSession`.
 *   6. Navigate to `moz-extension://<uuid>/popup.html` to inject session storage.
 *
 * ## Guard
 *
 * The full Firefox devnet flow is gated behind `FIREFOX_EXTENSION_E2E=1` because
 * it requires a locally installed Firefox and the devnet stack.
 *
 * XRPC calls flow directly from the extension background page to
 * `http://localhost:3000` (the devnet PDS). Requires `http://localhost/*` in the
 * extension manifest `host_permissions`.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { test as base, expect, firefox, type BrowserContext } from '@playwright/test';

import { createDevnetPost, deleteDevnetPost, type DevnetPost } from './devnet-records';
import { createPdsSession, type PdsSession } from './devnet-session';
import { resolveBuiltExtensionPath } from './extension-path';

export const firefoxDevnetEnabled = process.env['FIREFOX_EXTENSION_E2E'] === '1';


/**
 * Map from a launched BrowserContext to the discovered `moz-extension://<uuid>`
 * base URL for the loaded extension.  Set in the `context` fixture, read in
 * `devnetSession`.  WeakMap ensures entries are GC'd when the context closes.
 */
const _extensionBaseUrls = new WeakMap<BrowserContext, string>();

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

/** Find a free TCP port by briefly binding to port 0. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Install an extension as a temporary add-on via Firefox's Remote Debugging Protocol.
 *
 * Flow: connect → receive greeting → send getRoot → get addonsActor →
 *       send installTemporaryAddon → extract UUID from addon.url in response.
 *
 * @returns the bare UUID portion of the `moz-extension://<uuid>/` URL.
 */
async function installFirefoxTempAddon(rdpPort: number, addonPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = createConnection({ port: rdpPort, host: '127.0.0.1' });
    client.setTimeout(30_000);
    let buf = '';
    let step: 'greeting' | 'getRoot' | 'install' = 'greeting';
    let addonsActorId: string | undefined;

    const send = (msg: Record<string, unknown>): void => {
      const json = JSON.stringify(msg);
      client.write(`${Buffer.byteLength(json, 'utf8')}:${json}`);
    };

    const processMessages = (): void => {
      for (;;) {
        const colonIdx = buf.indexOf(':');
        if (colonIdx === -1) break;
        const len = Number(buf.substring(0, colonIdx));
        if (!Number.isFinite(len) || len <= 0) {
          buf = '';
          break;
        }
        if (buf.length < colonIdx + 1 + len) break;
        const msgStr = buf.substring(colonIdx + 1, colonIdx + 1 + len);
        buf = buf.substring(colonIdx + 1 + len);
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(msgStr) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (step === 'greeting') {
          step = 'getRoot';
          send({ to: 'root', type: 'getRoot' });
        } else if (step === 'getRoot') {
          addonsActorId = msg['addonsActor'] as string | undefined;
          if (!addonsActorId) {
            client.destroy();
            reject(new Error(`addonsActor not found in getRoot response: ${JSON.stringify(msg)}`));
            return;
          }
          step = 'install';
          send({ to: addonsActorId, type: 'installTemporaryAddon', addonPath });
        } else if (step === 'install') {
          if ('error' in msg) {
            client.destroy();
            reject(new Error(`installTemporaryAddon error: ${JSON.stringify(msg)}`));
            return;
          }
          const addon = msg['addon'] as Record<string, string> | undefined;
          const url = addon?.['url'] ?? '';
          const uuidMatch = url.match(/^moz-extension:\/\/([^/]+)\//);
          if (uuidMatch?.[1]) {
            client.destroy();
            resolve(uuidMatch[1]);
          } else {
            client.destroy();
            reject(new Error(`Could not extract UUID from RDP response. url=${url} msg=${JSON.stringify(msg)}`));
          }
        }
      }
    };

    client.on('data', (data: Buffer) => {
      buf += data.toString('utf8');
      processMessages();
    });
    client.on('error', reject);
    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Firefox RDP timed out on port ${rdpPort}`));
    });
  });
}

export const skipIfFirefoxDevnetDisabled = (): void => {
  base.skip(!firefoxDevnetEnabled, 'Firefox devnet E2E tests require FIREFOX_EXTENSION_E2E=1 and the devnet stack.');
};

export const test = base.extend<FirefoxDevnetFixtures & { context: BrowserContext }>({
  // Override the context fixture with a Firefox persistent context that has the
  // extension installed as a temporary add-on via the Firefox RDP protocol.
  context: async ({ browserName: _browserName }, use, testInfo) => {
    if (!firefoxDevnetEnabled) {
      testInfo.skip(true, 'Firefox devnet E2E tests require FIREFOX_EXTENSION_E2E=1 and the devnet stack.');
      // Provide a dummy value so TypeScript is satisfied — testInfo.skip() throws internally.
      await use(null as unknown as BrowserContext);
      return;
    }

    const extensionPath = await resolveBuiltExtensionPath('firefox');
    const profileDir = await mkdtemp(join(tmpdir(), 'skeeditor-firefox-devnet-'));

    try {
      // 1. Find a free port for Firefox's RDP server.
      const rdpPort = await findFreePort();

      // 2. Launch Firefox with the RDP debugger server enabled.
      //    firefoxUserPrefs allows unsigned extensions (required for installTemporaryAddon).
      const context = await firefox.launchPersistentContext(profileDir, {
        args: ['-start-debugger-server', String(rdpPort)],
        firefoxUserPrefs: {
          'xpinstall.signatures.required': false,
          'extensions.autoDisableScopes': 0,
          'extensions.enabledScopes': 15,
        },
      });

      // 3. Wait for Firefox's RDP server to start accepting connections.
      await new Promise(r => setTimeout(r, 2000));

      // 4. Install the extension as a temporary add-on via RDP and get its UUID.
      const uuid = await installFirefoxTempAddon(rdpPort, extensionPath);
      _extensionBaseUrls.set(context, `moz-extension://${uuid}`);

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

    // Inject the session into the extension's storage by navigating to the
    // popup page. The popup URL uses the UUID discovered from prefs.js above.
    const baseUrl = _extensionBaseUrls.get(context);
    if (!baseUrl) throw new Error('Firefox extension base URL not found — context fixture may not have run');

    const popupPage = await context.newPage();
    await popupPage.goto(`${baseUrl}/popup.html`);
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
          dpopEnabled: false,
        },
        pdsUrls: { [session.did]: pdsUrl },
      },
    );
    await popupPage.close();

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

    // Teardown: best-effort delete of the test post.
    try {
      await deleteDevnetPost(rawSession, post.did, post.rkey);
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
