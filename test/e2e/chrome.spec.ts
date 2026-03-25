import { resolve } from 'node:path';

import {
  OTHER_DID,
  OWN_POST_TEXT,
  TEST_AT_URI,
  TEST_DID,
  TEST_RKEY,
  test as bskyTest,
  makeMockGetRecordResult,
  makeMockPutRecordResult,
} from './fixtures/bsky-route-extension';
import { expect, test } from './fixtures/chromium-extension';

// ── Popup smoke tests ─────────────────────────────────────────────────────────

test('should load the extension popup in Chromium', async ({ extensionId, page }) => {
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  await expect(page.getByRole('heading', { name: 'skeeditor' })).toBeVisible();
  await expect(page.locator('auth-popup')).toBeAttached();
  // auth-popup renders a sign-in button once the (empty) session check resolves
  await expect(page.getByRole('button', { name: 'Sign in with Bluesky' })).toBeVisible({ timeout: 10000 });
});

test('should open the mock Bluesky fixture page for future content-script tests', async ({ page }) => {
  const mockPageUrl = new URL(`file://${resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html')}`);

  await page.goto(mockPageUrl.href);

  await expect(page.getByTestId('post')).toBeVisible();
  await expect(page.getByTestId('post-text').first()).toContainText('Hello from my own post');
});

// ── Content-script E2E tests ──────────────────────────────────────────────────
// These tests navigate the extension to https://bsky.app (intercepted via
// context.route) so the manifest content-script match fires, then assert DOM
// mutations made by the injected content script.

/**
 * skeeditor-vwhj — E2E: extension loads and injects content script on bsky.app
 *
 * Verifies that:
 * - The content script is injected when the extension navigates to bsky.app.
 * - The `data-skeeditor-processed` attribute appears on the own post once
 *   the async AUTH_GET_STATUS round-trip completes.
 * - Console emits the expected "content script loaded" message.
 */
bskyTest(
  'content script injects into bsky.app and processes own post',
  async ({ page, setAuthState, routeBskyApp }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await setAuthState(TEST_DID);
    await routeBskyApp();
    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);

    // Wait for content script to inject Edit button on the own post.
    const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
    await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 10_000 });

    // Post should be marked as processed by the content script.
    await expect(ownPost).toHaveAttribute('data-skeeditor-processed', 'true');

    // Content script logs a confirmation on startup.
    expect(consoleMessages.some(m => m.includes('content script loaded'))).toBe(true);
  },
);

/**
 * skeeditor-9zyf — E2E: edit button appears on own posts only
 *
 * Verifies that:
 * - An Edit button is injected only into the post owned by the authenticated DID.
 * - The other user's post receives no Edit button.
 */
bskyTest('edit button is injected on own posts and absent on others', async ({ page, setAuthState, routeBskyApp }) => {
  await setAuthState(TEST_DID);
  await routeBskyApp();
  await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);

  const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
  const otherPost = page.locator(`[data-at-uri^="at://${OTHER_DID}"]`);

  // Own post must have the Edit button.
  await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 10_000 });

  // Other user's post must NOT have an Edit button.
  await expect(otherPost.locator('.skeeditor-edit-button')).toHaveCount(0);
});

/**
 * skeeditor-iuey — E2E: edit modal opens, shows current text, saves edit
 *
 * Verifies the full happy-path edit flow:
 * - Clicking Edit opens the modal pre-populated with the record text from GET_RECORD.
 * - Editing the text enables the Save button.
 * - Clicking Save triggers PUT_RECORD and the modal shows a success message.
 */
bskyTest(
  'edit modal opens with post text and saves successfully',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, routeXrpcPutRecord }) => {
    await setAuthState(TEST_DID);
    await routeBskyApp();
    await routeXrpcGetRecord(makeMockGetRecordResult());
    await routeXrpcPutRecord(makeMockPutRecordResult());

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);

    const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
    const editButton = ownPost.locator('.skeeditor-edit-button');
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    // Modal should appear with the record text.
    const modal = page.locator('edit-modal');
    await expect(modal).toBeAttached({ timeout: 5_000 });
    const textarea = modal.locator('textarea');
    await expect(textarea).toHaveValue(OWN_POST_TEXT, { timeout: 5_000 });

    // Edit the text and save.
    await textarea.fill('Updated post text for E2E test');
    const saveButton = modal.locator('.save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Success feedback should appear.
    await expect(modal.locator('.status-message.success')).toBeVisible({ timeout: 5_000 });
    await expect(modal.locator('.status-message.success')).toContainText('Edit saved.');
  },
);

/**
 * skeeditor-yz58 — E2E: unauthenticated user sees no Edit button
 *
 * Verifies that without an active session, no Edit button is injected for
 * any post. (Auth state is deliberately not set in this test.)
 */
bskyTest('unauthenticated user sees no edit buttons', async ({ page, routeBskyApp }) => {
  // No setAuthState call → storage remains empty → AUTH_GET_STATUS returns { authenticated: false }
  await routeBskyApp();
  await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);

  // Allow the content script time to complete its AUTH_GET_STATUS round-trip.
  await page.waitForTimeout(2_000);

  // Neither the own post nor the other user's post should have an Edit button.
  await expect(page.locator('.skeeditor-edit-button')).toHaveCount(0);
});

/**
 * skeeditor-gz1w — E2E: concurrent edit conflict shows retry prompt
 *
 * Verifies that a 409 InvalidSwap response from PUT_RECORD causes the modal
 * to display the "post changed while editing" conflict message rather than
 * treating it as a generic error.
 */
bskyTest(
  'conflict on save shows retry prompt in modal',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, routeXrpcPutRecordConflict }) => {
    await setAuthState(TEST_DID);
    await routeBskyApp();
    // getRecord is called twice: once to populate the modal, once by putRecordWithSwap
    // after the conflict to fetch the latest server state for the merge advisory.
    await routeXrpcGetRecord(makeMockGetRecordResult());
    await routeXrpcPutRecordConflict();

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);

    const editButton = page.locator(`[data-at-uri="${TEST_AT_URI}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    await expect(modal.locator('textarea')).toBeVisible({ timeout: 5_000 });

    // Edit the text so Save is enabled.
    await modal.locator('textarea').fill('Attempted edit that will conflict');
    await modal.locator('.save-button').click();

    // Conflict response → modal shows "post changed" error, not a generic error.
    const statusMsg = modal.locator('.status-message.error');
    await expect(statusMsg).toBeVisible({ timeout: 5_000 });
    await expect(statusMsg).toContainText('This post changed while you were editing.');
  },
);
