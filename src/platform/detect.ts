import type { BrowserName, PlatformCapabilities } from './types';

/**
 * Detect the current browser by feature detection.
 *
 * Rule: never inspect `navigator.userAgent` or any other fingerprinting string.
 * Only check for the presence of browser-specific APIs.
 *
 * Detection order (most distinctive first):
 * 1. Firefox — `browser.runtime.getBrowserInfo` is a Firefox-only API.
 * 2. Safari — `globalThis.safari.extension` is set by the Safari Web Extension host.
 * 3. Chrome — default fallback for all Chromium-based browsers.
 */
export function detectPlatform(): PlatformCapabilities {
  const name = resolveName();
  return {
    name,
    isChromium: name === 'chrome',
    isFirefox: name === 'firefox',
    isSafari: name === 'safari',
  };
}

function resolveName(): BrowserName {
  try {
    if (typeof (browser.runtime as unknown as Record<string, unknown>)['getBrowserInfo'] === 'function') {
      return 'firefox';
    }
    const safariCandidate = (globalThis as Record<string, unknown>)['safari'];
    if (safariCandidate !== null && typeof safariCandidate === 'object' && 'extension' in (safariCandidate as object)) {
      return 'safari';
    }
    return 'chrome';
  } catch {
    console.warn('Platform detection failed; defaulting to unknown');
    return 'unknown';
  }
}
