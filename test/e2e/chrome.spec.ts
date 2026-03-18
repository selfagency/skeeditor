import { resolve } from 'node:path';

import { expect, test } from './fixtures/chromium-extension';

test('should load the extension popup in Chromium', async ({ extensionId, page }) => {
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  await expect(page.getByRole('heading', { name: 'skeeditor' })).toBeVisible();
  await expect(page.getByText('Popup entry loaded.')).toBeVisible();
});

test('should open the mock Bluesky fixture page for future content-script tests', async ({ page }) => {
  const mockPageUrl = new URL(`file://${resolve(process.cwd(), 'test/e2e/fixtures/mock-bsky-page.html')}`);

  await page.goto(mockPageUrl.href);

  await expect(page.getByTestId('post')).toBeVisible();
  await expect(page.getByTestId('post-text')).toContainText('extension E2E scaffolding');
});
