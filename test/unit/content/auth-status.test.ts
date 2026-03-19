import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installBrowserApiMocks, resetBrowserApiMocks } from '../../mocks/browser-apis';

installBrowserApiMocks();

vi.mock('../../../src/shared/messages', () => ({
  sendMessage: vi.fn(),
}));

import { sendMessage } from '../../../src/shared/messages';

let fetchAuthStatus: (typeof import('../../../src/content/auth-status'))['fetchAuthStatus'];
let getAuthStatus: (typeof import('../../../src/content/auth-status'))['getAuthStatus'];

beforeEach(async () => {
  vi.resetModules();
  resetBrowserApiMocks();
  const authModule = await import('../../../src/content/auth-status');
  fetchAuthStatus = authModule.fetchAuthStatus;
  getAuthStatus = authModule.getAuthStatus;
});

describe('fetchAuthStatus', () => {
  it('returns authenticated status with DID when background reports authenticated', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      authenticated: true,
      did: 'did:plc:alice',
      expiresAt: Date.now() + 60_000,
    });

    const status = await fetchAuthStatus();

    expect(status).toEqual({ authenticated: true, did: 'did:plc:alice' });
  });

  it('returns unauthenticated status when background reports unauthenticated', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ authenticated: false });

    const status = await fetchAuthStatus();

    expect(status).toEqual({ authenticated: false });
  });

  it('calls sendMessage with AUTH_GET_STATUS', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ authenticated: false });

    await fetchAuthStatus();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_GET_STATUS' });
  });

  it('returns unauthenticated when sendMessage throws', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('Extension context invalidated'));

    const status = await fetchAuthStatus();

    expect(status).toEqual({ authenticated: false });
  });
});

describe('getAuthStatus', () => {
  it('returns unauthenticated by default before fetchAuthStatus is called', () => {
    const status = getAuthStatus();
    expect(status.authenticated).toBe(false);
  });

  it('returns the cached status after fetchAuthStatus resolves', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      authenticated: true,
      did: 'did:plc:bob',
      expiresAt: Date.now() + 60_000,
    });

    await fetchAuthStatus();
    const status = getAuthStatus();

    expect(status).toEqual({ authenticated: true, did: 'did:plc:bob' });
  });
});
