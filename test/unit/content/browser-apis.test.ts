import { describe, expect, it } from 'vitest';

describe('browser API mocks', () => {
  it('should expose browser and chrome runtime mocks for unit tests', async () => {
    const browserResult = await globalThis.browser.runtime.sendMessage({ type: 'PING' });
    const chromeResult = await globalThis.chrome.storage.local.get('session');

    expect(browserResult).toEqual({ ok: true });
    expect(chromeResult).toEqual({});
  });
});
