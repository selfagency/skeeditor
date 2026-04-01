import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const extensionPath = resolve('dist/chrome');
// Extensions require headless:false; --headless=new activates Chrome-native headless
// so the process stays non-interactive while still loading the unpacked extension.
const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    '--headless=new',
    '--disable-extensions-except=' + extensionPath,
    '--load-extension=' + extensionPath,
    '--no-sandbox',
  ],
});

const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
const extensionId = sw.url().split('/')[2];
console.log('Extension ID:', extensionId);

// Set auth state
const popupPage = await context.newPage();
await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
await popupPage.waitForLoadState('domcontentloaded');
await popupPage.evaluate(
  async ({ did, session }) => {
    await chrome.storage.local.set({ sessions: { [did]: session }, activeDid: did });
  },
  {
    did: 'did:plc:testuser00000000000000',
    session: {
      did: 'did:plc:testuser00000000000000',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3_600_000,
      scope: 'atproto transition:generic',
    },
  },
);
await popupPage.close();

// Route bsky.app
const html = readFileSync('test/e2e/fixtures/mock-bsky-page.html', 'utf8');
await context.route('https://bsky.app/**', route =>
  route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
);

const page = await context.newPage();
page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]`, msg.text()));
page.on('pageerror', err => console.log('[PAGE_ERROR]', err.message, '\nSTACK:', err.stack));

// Also check what customElements is before the script loads
await page.addInitScript(() => {
  console.log('[INIT] typeof customElements:', typeof customElements);
  console.log('[INIT] customElements value:', customElements);
});

await page.goto('https://bsky.app/profile/did:plc:testuser00000000000000/post/testpost123456');
await page.waitForTimeout(8000);

const state = await page.evaluate(() => {
  const article = document.querySelector('[data-at-uri]');
  const btn = document.querySelector('.skeeditor-edit-button');
  const processed = article?.getAttribute('data-skeeditor-processed');
  const initialized = document.documentElement.getAttribute('data-skeeditor-initialized');
  return {
    hasArticle: !!article,
    atUri: article?.getAttribute('data-at-uri'),
    hasButton: !!btn,
    processed,
    initialized,
    bodySnippet: document.body.innerHTML.substring(0, 500),
  };
});
console.log('DOM state:', JSON.stringify(state, null, 2));

await context.close();
