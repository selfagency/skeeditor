import { describe, it, expect, vi } from 'vitest';

import { sendMessage } from '@src/shared/messages';

describe('sendMessage', () => {
  it('calls browser.runtime.sendMessage with the request and returns the response', async () => {
    const mockResponse = { ok: true as const };
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(mockResponse as never);

    const result = await sendMessage({ type: 'AUTH_SIGN_IN' });

    expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_SIGN_IN' });
    expect(result).toEqual(mockResponse);
  });

  it('forwards AUTH_GET_STATUS and returns the response', async () => {
    const mockResponse = { authenticated: true as const, did: 'did:plc:testuser', expiresAt: Date.now() + 60_000 };
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(mockResponse as never);

    const result = await sendMessage({ type: 'AUTH_GET_STATUS' });

    expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_GET_STATUS' });
    expect(result).toEqual(mockResponse);
  });

  it('forwards GET_RECORD with the full record payload', async () => {
    const mockResponse = { value: { $type: 'app.bsky.feed.post', text: 'hello' }, cid: 'bafyreiabc' };
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(mockResponse as never);

    const request = {
      type: 'GET_RECORD' as const,
      repo: 'did:plc:testuser',
      collection: 'app.bsky.feed.post',
      rkey: 'abc123',
    };
    const result = await sendMessage(request);

    expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith(request);
    expect(result).toEqual(mockResponse);
  });

  it('forwards PUT_RECORD with the full record payload', async () => {
    const mockResponse = { uri: 'at://did:plc:testuser/app.bsky.feed.post/abc123', cid: 'bafyreiabc' };
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(mockResponse as never);

    const request = {
      type: 'PUT_RECORD' as const,
      repo: 'did:plc:testuser',
      collection: 'app.bsky.feed.post',
      rkey: 'abc123',
      record: { $type: 'app.bsky.feed.post', text: 'edited' },
      swapRecord: 'bafyreiabc',
    };
    const result = await sendMessage(request);

    expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith(request);
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors thrown by browser.runtime.sendMessage', async () => {
    vi.mocked(browser.runtime.sendMessage).mockRejectedValueOnce(new Error('Extension context invalidated') as never);

    await expect(sendMessage({ type: 'AUTH_SIGN_OUT' })).rejects.toThrow('Extension context invalidated');
  });
});
