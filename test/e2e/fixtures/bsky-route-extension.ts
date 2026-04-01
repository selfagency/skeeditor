import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { test as chromiumBase, expect } from './chromium-extension';

// ── Test constants ────────────────────────────────────────────────────────────

/** DID used in mock-bsky-page.html for the "own" post article. */
export const TEST_DID = 'did:plc:testuser00000000000000';

/** rkey used in mock-bsky-page.html for the "own" post article. */
export const TEST_RKEY = 'testpost123456';

/** Full AT URI for the own post in mock-bsky-page.html. */
export const TEST_AT_URI = `at://${TEST_DID}/app.bsky.feed.post/${TEST_RKEY}` as const;

/** DID for the "other user" post in mock-bsky-page.html. */
export const OTHER_DID = 'did:plc:otheruser0000000000000';

/** Text content of the own post in mock-bsky-page.html. */
export const OWN_POST_TEXT = 'Hello from my own post. #testing';

const MOCK_PAGE_PATH = resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html');

// ── Mock record factory ───────────────────────────────────────────────────────

interface MockGetRecordResult {
  uri: string;
  value: {
    $type: string;
    text: string;
    createdAt: string;
  };
  cid: string;
}

interface MockPutRecordResult {
  uri: string;
  cid: string;
}

interface MockApplyWritesResult {
  results: Array<Record<string, unknown>>;
}

export const makeMockGetRecordResult = (text = OWN_POST_TEXT): MockGetRecordResult => ({
  uri: TEST_AT_URI,
  value: {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: '2026-03-25T12:00:00.000Z',
  },
  cid: 'bafyreigwqwhe2jxohagozazfbrf6dxgzphvkg3d3lg7uxdvepsimqyclka',
});

export const makeMockPutRecordResult = (): MockPutRecordResult => ({
  uri: TEST_AT_URI,
  cid: 'bafyreia6umzg3a6d7mjbow4p57tviey45muohklhgsvjoamcctoiusr4pe',
});

export const makeMockApplyWritesResult = (): MockApplyWritesResult => ({
  results: [
    { $type: 'com.atproto.repo.applyWrites#deleteResult' },
    {
      $type: 'com.atproto.repo.applyWrites#createResult',
      uri: TEST_AT_URI,
      cid: 'bafyreih6c2wqxd5dnhcg2rq3a5s3sjd7z6m7qwzlyax3vdv5s6hkqaa2ru',
    },
  ],
});

// ── Fixture interfaces ────────────────────────────────────────────────────────

interface BskyRouteFixtures {
  /**
   * Set the authenticated session in chrome.storage.local via the popup page.
   * Call this before navigating to bsky.app so AUTH_GET_STATUS resolves correctly.
   */
  setAuthState: (did: string) => Promise<void>;

  /**
   * Intercept all https://bsky.app/** requests and serve mock-bsky-page.html.
   * Call before page.goto so the content script receives the mock DOM.
   */
  routeBskyApp: () => Promise<void>;

  /**
   * Intercept the XRPC getRecord endpoint and respond with the given result.
   * Applied context-wide, so it covers both the initial fetch and any
   * fallback fetch after a conflict (putRecordWithSwap).
   */
  routeXrpcGetRecord: (result: ReturnType<typeof makeMockGetRecordResult>) => Promise<void>;

  /** Intercept the XRPC putRecord endpoint and respond with a success result. */
  routeXrpcPutRecord: (result: ReturnType<typeof makeMockPutRecordResult>) => Promise<void>;

  /**
   * Intercept the XRPC putRecord endpoint, capture the request body, and
   * respond with a success result. Returns the captured body for assertion.
   */
  capturePutRecord: (
    result: ReturnType<typeof makeMockPutRecordResult>,
  ) => Promise<{ getBody: () => Record<string, unknown> | null }>;

  /**
   * Intercept the XRPC applyWrites endpoint, capture the request body, and
   * respond with a success result. Returns the captured body for assertion.
   */
  captureApplyWrites: (
    result: ReturnType<typeof makeMockApplyWritesResult>,
  ) => Promise<{ getBody: () => Record<string, unknown> | null }>;

  /**
   * Intercept the XRPC putRecord endpoint and respond with a 409 InvalidSwap
   * conflict error so the edit-modal shows the "please reload and try again" prompt.
   */
  routeXrpcPutRecordConflict: () => Promise<void>;
}

// ── Extended test fixture ─────────────────────────────────────────────────────

export const test = chromiumBase.extend<BskyRouteFixtures>({
  setAuthState: async ({ context, extensionId }, use) => {
    await use(async (did: string) => {
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');
      // chrome.storage.local is available on extension pages.
      // session-store.ts now uses a DID-keyed sessions map + activeDid key.
      await popupPage.evaluate(
        async ({ did, session }) => {
          await chrome.storage.local.set({ sessions: { [did]: session }, activeDid: did });
        },
        {
          did,
          session: {
            did,
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 3_600_000,
            scope: 'atproto transition:generic',
          },
        },
      );
      await popupPage.close();
    });
  },

  routeBskyApp: async ({ context }, use) => {
    await use(async () => {
      const html = await readFile(MOCK_PAGE_PATH, 'utf8');
      await context.route('https://bsky.app/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
      );
    });
  },

  routeXrpcGetRecord: async ({ context }, use) => {
    await use(async result => {
      await context.route(/\/xrpc\/com\.atproto\.repo\.getRecord/, route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        }),
      );
    });
  },

  routeXrpcPutRecord: async ({ context }, use) => {
    await use(async result => {
      await context.route(/\/xrpc\/com\.atproto\.repo\.putRecord/, route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        }),
      );
    });
  },

  capturePutRecord: async ({ context }, use) => {
    await use(async result => {
      let captured: Record<string, unknown> | null = null;
      await context.route(/\/xrpc\/com\.atproto\.repo\.putRecord/, async route => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        captured = body;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        });
      });
      return { getBody: () => captured };
    });
  },

  captureApplyWrites: async ({ context }, use) => {
    await use(async result => {
      let captured: Record<string, unknown> | null = null;
      await context.route(/\/xrpc\/com\.atproto\.repo\.applyWrites/, async route => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        captured = body;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        });
      });
      return { getBody: () => captured };
    });
  },

  routeXrpcPutRecordConflict: async ({ context }, use) => {
    await use(async () => {
      await context.route(/\/xrpc\/com\.atproto\.repo\.putRecord/, route =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InvalidSwap', message: 'Record has been modified since last read' }),
        }),
      );
    });
  },
});

export { expect };
