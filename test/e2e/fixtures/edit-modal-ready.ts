import { expect, type Locator } from '@playwright/test';

export async function waitForEditModalReady(modal: Locator, expectedText?: string): Promise<Locator> {
  await expect(modal).toBeAttached({ timeout: 10_000 });

  const loadingState = modal.locator('.loading-state');
  await expect(loadingState).toHaveClass(/hidden/, { timeout: 10_000 });

  const textarea = modal.locator('textarea');
  if (expectedText !== undefined) {
    await expect(textarea).toHaveValue(expectedText, { timeout: 10_000 });
  }

  await expect(textarea).toBeEditable({ timeout: 10_000 });
  return textarea;
}
