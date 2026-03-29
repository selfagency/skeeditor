/**
 * test/e2e/firefox-devnet.spec.ts
 *
 * Real-network E2E tests for the skeeditor Firefox extension using the
 * atproto-devnet stack. Mirrors chrome-devnet.spec.ts but runs with a Firefox
 * persistent context that has the extension pre-installed via a custom profile.
 *
 * Prerequisites:
 *   - `FIREFOX_EXTENSION_E2E=1` environment variable must be set.
 *   - Firefox Developer Edition must be installed and reachable.
 *   - The devnet stack must be running: `pnpm devnet:up`
 *   - The Firefox extension must be built: `pnpm build:firefox`
 *
 * Run this project: `FIREFOX_EXTENSION_E2E=1 pnpm test:e2e:firefox:devnet`
 */
import {
  test,
  expect,
  skipIfFirefoxDevnetDisabled,
} from './fixtures/firefox-devnet-extension';
import { getDevnetPostText, updateDevnetPostExternal } from './fixtures/devnet-records';

// ── Test suite ──────────────────────────────────────────────────────────────

/**
 * skeeditor-akvi·6 — Firefox devnet: content script detects real post and injects Edit button
 */
test(
  'content script injects Edit button for own real devnet post (Firefox)',
  async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
    skipIfFirefoxDevnetDisabled();

    await routeDevnetBskyApp();
    await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

    const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
    await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });
    await expect(ownPost).toHaveAttribute('data-skeeditor-processed', 'true');
  },
);

/**
 * skeeditor-akvi·7 — Firefox devnet: edit button absent on other users' posts
 */
test(
  'edit button is absent on other users posts (Firefox)',
  async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
    skipIfFirefoxDevnetDisabled();

    await routeDevnetBskyApp();
    await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

    const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
    await expect(ownPost.locator('.skeeditor-edit-button')).toBeVisible({ timeout: 15_000 });

    const foreignPost = page.locator(
      '[data-at-uri="at://did:plc:devnetotheruser000000/app.bsky.feed.post/otherpost_devnet"]',
    );
    await expect(foreignPost.locator('.skeeditor-edit-button')).toHaveCount(0);
  },
);

/**
 * skeeditor-akvi·8 — Firefox devnet: edit modal saves real post text to PDS
 */
test(
  'edit modal saves real post text to devnet PDS (Firefox)',
  async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
    skipIfFirefoxDevnetDisabled();

    await routeDevnetBskyApp();
    await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

    const ownPost = page.locator(`[data-at-uri="${devnetPost.uri}"]`);
    const editButton = ownPost.locator('.skeeditor-edit-button');
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    await expect(modal).toBeAttached({ timeout: 5_000 });

    const textarea = modal.locator('textarea');
    await expect(textarea).toHaveValue(devnetPost.text, { timeout: 10_000 });

    const updatedText = `${devnetPost.text} [edited by devnet E2E Firefox]`;
    await textarea.fill(updatedText);
    const saveButton = modal.locator('.save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(modal).not.toBeAttached({ timeout: 10_000 });

    const savedText = await getDevnetPostText(devnetSession, devnetPost.did, devnetPost.rkey);
    expect(savedText).toBe(updatedText);
  },
);

/**
 * skeeditor-akvi·9 — Firefox devnet: unauthenticated user sees no Edit buttons
 */
test(
  'unauthenticated user sees no Edit buttons on devnet post page (Firefox)',
  async ({ page, devnetPost, routeDevnetBskyApp }) => {
    skipIfFirefoxDevnetDisabled();

    await routeDevnetBskyApp();
    await page.goto(`https://bsky.app/profile/${devnetPost.did}/post/${devnetPost.rkey}`);

    await page.waitForSelector(':root[data-skeeditor-initialized]', { timeout: 15_000 });

    await expect(page.locator('.skeeditor-edit-button')).toHaveCount(0);
  },
);

/**
 * skeeditor-akvi·10 — Firefox devnet: save conflict shows retry message
 */
test(
  'concurrent edit conflict shows retry prompt (Firefox)',
  async ({ page, devnetSession, devnetPost, routeDevnetBskyApp }) => {
    skipIfFirefoxDevnetDisabled();

    await routeDevnetBskyApp();
    await page.goto(`https://bsky.app/profile/${devnetSession.did}/post/${devnetPost.rkey}`);

    const editButton = page.locator(`[data-at-uri="${devnetPost.uri}"] .skeeditor-edit-button`);
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();

    const modal = page.locator('edit-modal');
    const textarea = modal.locator('textarea');
    await expect(textarea).toHaveValue(devnetPost.text, { timeout: 10_000 });

    await updateDevnetPostExternal(
      devnetSession,
      devnetPost.did,
      devnetPost.rkey,
      `${devnetPost.text} [external concurrent edit]`,
    );

    await textarea.fill(`${devnetPost.text} [local edit that will conflict]`);
    const saveButton = modal.locator('.save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    const statusMsg = modal.locator('.status-message.error');
    await expect(statusMsg).toBeVisible({ timeout: 10_000 });
    await expect(statusMsg).toContainText('This post changed while you were editing.');
  },
);
