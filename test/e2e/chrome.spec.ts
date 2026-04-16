import { resolve } from 'node:path';

import {
  OTHER_DID,
  OWN_POST_TEXT,
  TEST_AT_URI,
  TEST_DID,
  TEST_RKEY,
  makeMockApplyWritesResult,
  test as bskyTest,
  makeMockGetRecordResult,
  makeMockPutRecordResult,
} from './fixtures/bsky-route-extension';
import { expect, test } from './fixtures/chromium-extension';
import { waitForContentScriptReady } from './fixtures/content-script-ready';
import { waitForEditModalReady } from './fixtures/edit-modal-ready';
import { createMockSession, seedPopupAuthState, setExtensionSettings } from './fixtures/extension-storage';

// ── Popup smoke tests ─────────────────────────────────────────────────────────

test('should load the extension popup in Chromium', async ({ extensionId, page }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.getByRole('heading', { name: 'skeeditor' })).toBeVisible();
  await expect(page.locator('auth-popup')).toBeAttached();
  // auth-popup renders a sign-in button once the (empty) session check resolves
  await expect(page.getByRole('button', { name: 'Sign in with Bluesky' })).toBeVisible({ timeout: 10000 });
});

test('should open the mock Bluesky fixture page for future content-script tests', async ({ page }) => {
  const mockPageUrl = new URL(`file://${resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html')}`);

  await page.goto(mockPageUrl.href);

  await expect(page.getByTestId('post').first()).toBeVisible();
  await expect(page.getByTestId('post-text').first()).toContainText('Hello from my own post');
});

test('sign in triggers OAuth tab handoff', async ({ context, extensionId, page }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const [authPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 10_000 }),
    page.getByRole('button', { name: 'Sign in with Bluesky' }).click(),
  ]);

  await authPage.waitForLoadState('domcontentloaded');
  await expect.poll(() => authPage.url()).toContain('/oauth/authorize');
  await authPage.close();
});

test('reauthorize action opens OAuth tab when authenticated', async ({ context, extensionId, page }) => {
  const primaryDid = TEST_DID;
  await seedPopupAuthState(context, extensionId, {
    sessions: { [primaryDid]: createMockSession(primaryDid, 'test.bsky.social') },
    activeDid: primaryDid,
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('button', { name: 'Reauthorize' })).toBeVisible();

  const [authPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 10_000 }),
    page.getByRole('button', { name: 'Reauthorize' }).click(),
  ]);

  await authPage.waitForLoadState('domcontentloaded');
  await expect.poll(() => authPage.url()).toContain('/oauth/authorize');
  await authPage.close();
});

test('account switch updates activeDid in storage', async ({ context, extensionId, page }) => {
  const primaryDid = TEST_DID;
  const secondaryDid = 'did:plc:secondaryuser00000000000';
  await seedPopupAuthState(context, extensionId, {
    sessions: {
      [primaryDid]: createMockSession(primaryDid, 'test.bsky.social'),
      [secondaryDid]: createMockSession(secondaryDid, 'second.bsky.social'),
    },
    activeDid: primaryDid,
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByText('second.bsky.social')).toBeVisible();
  await page.getByRole('button', { name: 'Switch' }).click();

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const value = await chrome.storage.local.get('activeDid');
        return value['activeDid'] as string | undefined;
      }),
    )
    .toBe(secondaryDid);
});

test('sign out account transitions popup back to unauthenticated state', async ({ context, extensionId, page }) => {
  await seedPopupAuthState(context, extensionId, {
    sessions: { [TEST_DID]: createMockSession(TEST_DID, 'test.bsky.social') },
    activeDid: TEST_DID,
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('button', { name: 'Sign in with Bluesky' })).toBeVisible({ timeout: 10_000 });
});

test('labeler prompt can be dismissed from popup', async ({ context, extensionId, page }) => {
  await seedPopupAuthState(context, extensionId, {
    sessions: { [TEST_DID]: createMockSession(TEST_DID, 'test.bsky.social') },
    activeDid: TEST_DID,
    pendingLabelerPrompt: true,
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const dismissButton = page.getByRole('button', { name: 'Not now' });
  await expect(dismissButton).toBeVisible();
  await dismissButton.click();

  await expect(dismissButton).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const value = await chrome.storage.local.get('pendingLabelerPrompt');
        return value['pendingLabelerPrompt'];
      }),
    )
    .toBeUndefined();
});

test('settings button opens options page', async ({ context, extensionId, page }) => {
  await seedPopupAuthState(context, extensionId, {
    sessions: { [TEST_DID]: createMockSession(TEST_DID, 'test.bsky.social') },
    activeDid: TEST_DID,
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const [optionsPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 10_000 }),
    page.getByRole('button', { name: 'Settings' }).click(),
  ]);

  await optionsPage.waitForLoadState('domcontentloaded');
  await expect.poll(() => optionsPage.url()).toContain('chrome://extensions/?options=');
  await optionsPage.close();
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
    await waitForContentScriptReady(page);

    // Wait for content script to inject Edit button on the own post.
    const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
    await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });

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
  await waitForContentScriptReady(page);

  const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
  const otherPost = page.locator(`[data-at-uri^="at://${OTHER_DID}"]`);

  // Own post must have the Edit button.
  await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });

  // Other user's post must NOT have an Edit button.
  await expect(otherPost.locator('.skeeditor-edit-button')).toHaveCount(0);
});

/**
 * skeeditor-iuey — E2E: edit modal opens, shows current text, saves edit
 *
 * Verifies the full happy-path edit flow:
 * - Clicking Edit opens the modal pre-populated with the record text from GET_RECORD.
 * - Editing the text enables the Save button.
 * - Clicking Save triggers RECREATE_RECORD/applyWrites and the modal closes successfully.
 */
bskyTest(
  'edit modal opens with post text and saves successfully',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, captureApplyWrites }) => {
    await setAuthState(TEST_DID);
    await routeBskyApp();
    await routeXrpcGetRecord(makeMockGetRecordResult());
    await captureApplyWrites(makeMockApplyWritesResult());

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
    await waitForContentScriptReady(page);

    const ownPost = page.locator(`[data-at-uri="${TEST_AT_URI}"]`);
    const editButton = ownPost.locator('.skeeditor-edit-button');
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    // Modal should appear with the record text.
    const modal = page.locator('edit-modal');
    const textarea = await waitForEditModalReady(modal, OWN_POST_TEXT);

    // Edit the text and save.
    await textarea.fill('Updated post text for E2E test');
    const saveButton = modal.locator('.save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Modal should close and a toast notification should appear.
    await expect(modal).not.toBeAttached({ timeout: 5_000 });
    const toast = page.locator('skeeditor-toast');
    await expect(toast).toBeAttached({ timeout: 5_000 });
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

  // Wait for the content script to complete its AUTH_GET_STATUS round-trip. The content
  // script stamps data-skeeditor-initialized on <html> after refreshAuthState() settles.
  await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
  await waitForContentScriptReady(page);

  // Neither the own post nor the other user's post should have an Edit button.
  await expect(page.locator('.skeeditor-edit-button')).toHaveCount(0);
});

bskyTest(
  'edit time limit prevents editing older posts',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, context, extensionId }) => {
    await setExtensionSettings(context, extensionId, { editTimeLimit: 0.5, saveStrategy: 'edit' });

    await setAuthState(TEST_DID);
    await routeBskyApp();
    await routeXrpcGetRecord(makeMockGetRecordResult(OWN_POST_TEXT, '2020-01-01T00:00:00.000Z'));

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
    await waitForContentScriptReady(page);

    const editButton = page.locator(`[data-at-uri="${TEST_AT_URI}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    await expect(modal).toBeAttached({ timeout: 10_000 });
    await expect(modal.locator('.loading-state')).toHaveClass(/hidden/, { timeout: 10_000 });
    await expect(modal.locator('textarea')).toHaveValue(OWN_POST_TEXT, { timeout: 10_000 });
    await expect(modal.locator('.status-message.error')).toContainText('older than your edit time limit');
    await expect(modal.locator('textarea')).toBeDisabled();
    await expect(modal.locator('.save-button')).toBeDisabled();
  },
);

/**
 * skeeditor-gz1w — E2E: concurrent edit conflict shows retry prompt
 *
 * Verifies that a 409 InvalidSwap response from PUT_RECORD causes the modal
 * to display the "post changed while editing" conflict message rather than
 * treating it as a generic error.
 */
bskyTest(
  'conflict on save shows retry prompt in modal',
  async ({
    page,
    setAuthState,
    routeBskyApp,
    routeXrpcGetRecord,
    routeXrpcPutRecordConflict,
    context,
    extensionId,
  }) => {
    await setExtensionSettings(context, extensionId, { editTimeLimit: null, saveStrategy: 'edit' });

    await setAuthState(TEST_DID);
    await routeBskyApp();
    // getRecord is called twice: once to populate the modal, once by putRecordWithSwap
    // after the conflict to fetch the latest server state for the merge advisory.
    await routeXrpcGetRecord(makeMockGetRecordResult());
    await routeXrpcPutRecordConflict();

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
    await waitForContentScriptReady(page);

    const editButton = page.locator(`[data-at-uri="${TEST_AT_URI}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    await waitForEditModalReady(modal, OWN_POST_TEXT);

    // Edit the text so Save is enabled.
    await modal.locator('textarea').fill('Attempted edit that will conflict');
    await modal.locator('.save-button').click();

    // Conflict response → modal shows "post changed" error, not a generic error.
    const statusMsg = modal.locator('.status-message.error');
    await expect(statusMsg).toBeVisible({ timeout: 5_000 });
    await expect(statusMsg).toContainText('This post changed while you were editing.');
  },
);

/**
 * Verifies that when saveStrategy is 'edit', the extension still uses PUT_RECORD
 * and preserves the original createdAt in the stored record body.
 */
bskyTest(
  'PUT_RECORD body preserves createdAt when saveStrategy is edit',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, capturePutRecord, context, extensionId }) => {
    // Set saveStrategy to 'edit' in storage before navigating.
    await setExtensionSettings(context, extensionId, { editTimeLimit: null, saveStrategy: 'edit' });

    await setAuthState(TEST_DID);
    await routeBskyApp();
    await routeXrpcGetRecord(makeMockGetRecordResult());
    const { getBody } = await capturePutRecord(makeMockPutRecordResult());
    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
    await waitForContentScriptReady(page);

    const editButton = page.locator(`[data-at-uri="${TEST_AT_URI}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    const textarea = await waitForEditModalReady(modal, OWN_POST_TEXT);
    await textarea.fill('Updated text preserving record identity');
    await modal.locator('.save-button').click();
    await expect(modal).not.toBeAttached({ timeout: 5_000 });

    const body = getBody();
    expect(body).not.toBeNull();
    const record = (body as Record<string, unknown>)['record'] as Record<string, unknown>;
    expect(record['createdAt']).toBe('2026-03-25T12:00:00.000Z');
  },
);

/**
 * Verifies that when saveStrategy is 'recreate', the extension uses applyWrites
 * with delete+create and generates a fresh createdAt in the recreated record.
 */
bskyTest(
  'RECREATE_RECORD uses applyWrites with a fresh createdAt when saveStrategy is recreate',
  async ({ page, setAuthState, routeBskyApp, routeXrpcGetRecord, captureApplyWrites, context, extensionId }) => {
    await setExtensionSettings(context, extensionId, { editTimeLimit: null, saveStrategy: 'recreate' });

    await setAuthState(TEST_DID);
    await routeBskyApp();
    await routeXrpcGetRecord(makeMockGetRecordResult());
    const { getBody } = await captureApplyWrites(makeMockApplyWritesResult());

    const before = Date.now();

    await page.goto(`https://bsky.app/profile/${TEST_DID}/post/${TEST_RKEY}`);
    await waitForContentScriptReady(page);

    const editButton = page.locator(`[data-at-uri="${TEST_AT_URI}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    const textarea = await waitForEditModalReady(modal, OWN_POST_TEXT);
    await textarea.fill('Updated text recreated as fresh');
    await modal.locator('.save-button').click();
    await expect(modal).not.toBeAttached({ timeout: 5_000 });

    const body = getBody();
    expect(body).not.toBeNull();
    const writes = (body as Record<string, unknown>)['writes'] as Array<Record<string, unknown>>;
    expect(writes).toHaveLength(2);
    expect(writes[0]?.['$type']).toBe('com.atproto.repo.applyWrites#delete');
    expect(writes[1]?.['$type']).toBe('com.atproto.repo.applyWrites#create');
    const record = writes[1]?.['value'] as Record<string, unknown>;
    expect(record['createdAt']).not.toBe('2026-03-25T12:00:00.000Z');
    const savedMs = new Date(record['createdAt'] as string).getTime();
    const after = Date.now();
    expect(savedMs).toBeGreaterThanOrEqual(before - 5000);
    expect(savedMs).toBeLessThanOrEqual(after + 5000);
  },
);
