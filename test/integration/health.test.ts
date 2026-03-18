import { describe, expect, it } from 'vitest';

import { BSKY_APP_ORIGIN } from '../../src/shared/constants';

describe('MSW-backed integration flow', () => {
  it('should resolve a mocked XRPC health request', async () => {
    const response = await fetch(`${BSKY_APP_ORIGIN}/xrpc/_health`);
    const payload = (await response.json()) as { ok: boolean; service: string };

    expect(response.ok).toBe(true);
    expect(payload).toEqual({ ok: true, service: 'skeeditor' });
  });
});
