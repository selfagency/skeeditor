import type { Page } from '@playwright/test';

/**
 * Wait for the skeeditor content script to finish its startup AUTH_GET_STATUS
 * round-trip. The content script stamps `data-skeeditor-initialized` on <html>
 * once it resolves. In CI (headless Ubuntu, cold MV3 service worker) this can
 * take up to ~30 s; 60 s provides a safe margin below the 90 s per-test timeout.
 */
const CONTENT_SCRIPT_READY_TIMEOUT_MS = 60_000;

export async function waitForContentScriptReady(page: Page): Promise<void> {
  await page.waitForSelector('html[data-skeeditor-initialized]', {
    timeout: CONTENT_SCRIPT_READY_TIMEOUT_MS,
  });
}
