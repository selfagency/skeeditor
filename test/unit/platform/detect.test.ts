import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectPlatform } from '@src/platform/detect';

describe('detectPlatform', () => {
  afterEach(() => {
    // Clean up any Safari global added per-test
    if ('safari' in globalThis) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as Record<string, unknown>)['safari'];
    }
  });

  it('should return "chrome" when no Firefox- or Safari-specific APIs are present', () => {
    // Default mock exposes runtime without getBrowserInfo; no globalThis.safari
    const result = detectPlatform();

    expect(result.name).toBe('chrome');
    expect(result.isChromium).toBe(true);
    expect(result.isFirefox).toBe(false);
    expect(result.isSafari).toBe(false);
  });

  it('should return "firefox" when browser.runtime.getBrowserInfo is a function', () => {
    // Simulate a Firefox environment by adding the Firefox-only API
    (browser.runtime as unknown as Record<string, unknown>)['getBrowserInfo'] = vi.fn();

    const result = detectPlatform();

    expect(result.name).toBe('firefox');
    expect(result.isChromium).toBe(false);
    expect(result.isFirefox).toBe(true);
    expect(result.isSafari).toBe(false);

    delete (browser.runtime as unknown as Record<string, unknown>)['getBrowserInfo'];
  });

  it('should return "safari" when globalThis.safari.extension is defined', () => {
    // Simulate a Safari WebExtension environment
    Object.defineProperty(globalThis, 'safari', {
      value: { extension: {} },
      configurable: true,
    });

    const result = detectPlatform();

    expect(result.name).toBe('safari');
    expect(result.isChromium).toBe(false);
    expect(result.isFirefox).toBe(false);
    expect(result.isSafari).toBe(true);
  });

  it('should give Firefox precedence over Chrome when both signals appear', () => {
    // Edge case: getBrowserInfo exists and globalThis.safari is also set
    (browser.runtime as unknown as Record<string, unknown>)['getBrowserInfo'] = vi.fn();
    Object.defineProperty(globalThis, 'safari', {
      value: { extension: {} },
      configurable: true,
    });

    const result = detectPlatform();

    expect(result.name).toBe('firefox');

    delete (browser.runtime as unknown as Record<string, unknown>)['getBrowserInfo'];
  });
});
