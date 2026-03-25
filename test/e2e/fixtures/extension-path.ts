import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const VALID_BROWSERS = ['chrome', 'firefox', 'safari'] as const;
type Browser = (typeof VALID_BROWSERS)[number];

/**
 * Resolve the path to the built extension for the current browser target.
 *
 * The browser is determined (in order) by:
 * - The `BROWSER` environment variable
 * - Falls back to `'chrome'` for Chromium-based E2E tests.
 *
 * Output structure: `dist/<browser>/`
 */
export const resolveBuiltExtensionPath = async (browserOverride?: Browser): Promise<string> => {
  const rawBrowser = browserOverride ?? process.env['BROWSER'] ?? 'chrome';
  const browser: Browser = (VALID_BROWSERS as readonly string[]).includes(rawBrowser)
    ? (rawBrowser as Browser)
    : 'chrome';

  const extensionPath = resolve(process.cwd(), 'dist', browser);

  await Promise.all([
    access(resolve(extensionPath, 'background/service-worker.js')),
    access(resolve(extensionPath, 'manifest.json')),
    access(resolve(extensionPath, 'popup/popup.html')),
  ]);

  return extensionPath;
};
