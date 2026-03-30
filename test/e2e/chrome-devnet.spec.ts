/**
 * test/e2e/chrome-devnet.spec.ts
 *
 * Real-network E2E tests for the skeeditor Chrome extension using the
 * atproto-devnet stack. These tests exercise the full round-trip:
 *   browser → extension content script → service worker → devnet PDS
 *
 * Unlike the mock-based chrome.spec.ts, these tests:
 * - Create real post records on the devnet PDS.
 * - Let XRPC calls flow directly to http://localhost:3000 (no route interception).
 * - Verify record mutations by reading back from the PDS.
 *
 * Prerequisites:
 *   - The devnet stack must be running: `pnpm devnet:up`
 *   - The Chrome extension must be built: `pnpm build:chrome`
 *
 * Run this project: `pnpm test:e2e:chromium:devnet`
 */
import { expect, test } from './fixtures/chromium-devnet-extension';
import { getDevnetPostText, updateDevnetPostExternal } from './fixtures/devnet-records';

// ── Test suite ──────────────────────────────────────────────────────────────

/**
 * skeeditor-akvi·1 — devnet: content script detects real post and injects Edit button
 *
 * Verifies that the content script:
 * - Correctly identifies the post's AT-URI from the real devnet record.
 * - Injects the Edit button on Alice's own post.
 * - Marks the post as processed (`data-skeeditor-processed`).
 */
test('content script injects Edit button for own real devnet post', async ({
  page,
  devnetSession,
  devnetPost,
  routeDevnetBskyApp,
}) => {
  await routeDevnetBskyApp();
  await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

  const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
  await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });
  await expect(ownPost).toHaveAttribute('data-skeeditor-processed', 'true');
});

/**
 * skeeditor-akvi·2 — devnet: edit button appears on own post only
 *
 * Verifies that other users' posts do not receive an Edit button.
 */
test('edit button is absent on other users posts', async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
  await routeDevnetBskyApp();
  await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

  const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
  await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });

  // The mock page includes a second post from a foreign DID; it must have no Edit button.
  const foreignPost = page.locator(
    '[data-at-uri="at://did:plc:devnetotheruser000000/app.bsky.feed.post/otherpost_devnet"]',
  );
  await expect(foreignPost.locator('.skeeditor-edit-button')).toHaveCount(0);
});

/**
 * skeeditor-akvi·3 — devnet: edit modal saves real post text to PDS
 *
 * Full happy-path verification:
 * - Edit modal opens pre-populated with the real record text from the devnet PDS.
 * - Submitting a change via the Save button updates the record on the PDS.
 * - The updated text is confirmed by reading back via `getDevnetPostText`.
 */
test('edit modal saves real post text to devnet PDS', async ({
  page,
  devnetSession,
  devnetPost,
  routeDevnetBskyApp,
}) => {
  await routeDevnetBskyApp();
  await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

  const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
  const editButton = ownPost.locator('.skeeditor-edit-button');
  await expect(editButton).toBeVisible({ timeout: 15_000 });
  await editButton.click();

  const modal = page.locator('edit-modal');
  await expect(modal).toBeAttached({ timeout: 5_000 });

  // The modal must be pre-populated with the original post text from the real PDS.
  const textarea = modal.locator('textarea');
  await expect(textarea).toHaveValue(devnetPost.text, { timeout: 10_000 });

  // Edit and save.
  const updatedText = `${devnetPost.text} [edited by devnet E2E]`;
  await textarea.fill(updatedText);
  const saveButton = modal.locator('.save-button');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait for success indication.
  await expect(modal).not.toBeAttached({ timeout: 10_000 });

  // Confirm the PDS record was actually updated.
  const savedText = await getDevnetPostText(devnetSession, devnetPost.did, devnetPost.rkey);
  expect(savedText).toBe(updatedText);
});

/**
 * skeeditor-akvi·4 — devnet: unauthenticated user sees no Edit buttons
 *
 * Verifies that when no session is stored (fixture's devnetSession is NOT used),
 * the content script does not inject any Edit buttons.
 */
test('unauthenticated user sees no Edit buttons on devnet post page', async ({
  page,
  devnetPost,
  routeDevnetBskyApp,
}) => {
  // No devnetSession → extension storage is empty → AUTH_GET_STATUS returns unauthenticated.
  // We still create a devnetPost so the HTML mock has a real AT-URI to embed.
  await routeDevnetBskyApp();
  await page.goto(`https://bsky.app/profile/${devnetPost.did}/post/${devnetPost.rkey}`);

  // Wait for the content script to complete its auth check.
  await page.waitForSelector(':root[data-skeeditor-initialized]', { timeout: 15_000 });

  await expect(page.locator('.skeeditor-edit-button')).toHaveCount(0);
});

/**
 * skeeditor-akvi·5 — devnet: save conflict shows retry message when post changed externally
 *
 * Race-condition verification:
 * 1. The edit modal opens and GET_RECORD caches the current CID.
 * 2. An external agent updates the post (simulating a concurrent edit).
 * 3. The user saves — PUT_RECORD is called with the stale swap CID.
 * 4. The PDS returns 409 InvalidSwap.
 * 5. The modal must display the "post changed while editing" conflict message.
 */
test('concurrent edit conflict shows retry prompt', async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
  await routeDevnetBskyApp();
  await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

  const editButton = page.locator(`[data-at-uri="${devnetPost.uri}"] .skeeditor-edit-button`);
  await expect(editButton).toBeVisible({ timeout: 15_000 });
  await editButton.click();

  const modal = page.locator('edit-modal');
  const textarea = modal.locator('textarea');

  // Wait for the modal to be fully loaded with the record text (GET_RECORD completed).
  await expect(textarea).toHaveValue(devnetPost.text, { timeout: 10_000 });

  // NOW update the post externally — the PDS record CID changes, causing a conflict.
  await updateDevnetPostExternal(
    devnetSession,
    devnetPost.did,
    devnetPost.rkey,
    `${devnetPost.text} [external concurrent edit]`,
  );

  // Attempt to save with the now-stale CID.
  await textarea.fill(`${devnetPost.text} [local edit that will conflict]`);
  const saveButton = modal.locator('.save-button');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // The modal must display the conflict error message.
  const statusMsg = modal.locator('.status-message.error');
  await expect(statusMsg).toBeVisible({ timeout: 10_000 });
  await expect(statusMsg).toContainText('This post changed while you were editing.');
});
