import { describe, expect, it, vi } from 'vitest';

import { XrpcClient, XrpcClientError } from '@src/shared/api/xrpc-client';

describe('XrpcClient', () => {
  describe('construction', () => {
    it('should throw when constructed without a service URL', () => {
      // @ts-expect-error intentional missing arg
      expect(() => new XrpcClient({})).toThrow(XrpcClientError);
    });

    it('should construct successfully with a service URL', () => {
      const client = new XrpcClient({ service: 'https://bsky.social' });

      expect(client).toBeInstanceOf(XrpcClient);
    });

    it('should construct successfully with an authenticated session', () => {
      const client = new XrpcClient({
        service: 'https://bsky.social',
        did: 'did:plc:abc123',
        accessJwt: 'eyJhbGciOiJIUzI1NiJ9.test.sig',
      });

      expect(client).toBeInstanceOf(XrpcClient);
    });
  });

  describe('getRecord', () => {
    it('should call the underlying XRPC client with correct params', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafytest', value: {} },
      });
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.getRecord = mockGet;

      await client.getRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
      });

      expect(mockGet).toHaveBeenCalledWith('app.bsky.feed.post', 'rkey1', {
        repo: 'did:plc:abc123',
      });
    });

    it('should return { value, cid } from the XRPC response', async () => {
      const mockValue = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.getRecord = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafytest', value: mockValue },
      });

      const result = await client.getRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
      });

      expect(result).toEqual({ value: mockValue, cid: 'bafytest' });
    });

    it('should wrap XrpcResponseError in XrpcClientError with status code', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockErr = new XrpcResponseError(
        { nsid: 'com.atproto.repo.getRecord' } as any,
        { status: 404, headers: new Headers() } as any,
        { body: { error: 'RecordNotFound', message: 'Record not found' } } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.getRecord = vi.fn().mockRejectedValue(mockErr);

      await expect(
        client.getRecord({ repo: 'did:plc:abc123', collection: 'app.bsky.feed.post', rkey: 'missing' }),
      ).rejects.toThrow(XrpcClientError);
    });

    it('should preserve the original error as the cause', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = new XrpcResponseError(
        { nsid: 'com.atproto.repo.getRecord' } as any,
        { status: 404, headers: new Headers() } as any,
        { body: { error: 'RecordNotFound', message: 'Record not found' } } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.getRecord = vi.fn().mockRejectedValue(original);

      const caught = await client
        .getRecord({ repo: 'did:plc:abc123', collection: 'app.bsky.feed.post', rkey: 'missing' })
        .catch((e: unknown) => e);

      expect((caught as XrpcClientError).cause).toBe(original);
    });
  });

  describe('putRecord', () => {
    it('should call the underlying XRPC client with record and rkey', async () => {
      const mockPut = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = mockPut;

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };

      await client.putRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
      });

      expect(mockPut).toHaveBeenCalledWith(record, 'rkey1', {
        repo: 'did:plc:abc123',
        validate: true,
      });
    });

    it('should default validate to true for server-side Lexicon validation', async () => {
      const mockPut = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = mockPut;

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };

      await client.putRecord({ repo: 'did:plc:abc123', collection: 'app.bsky.feed.post', rkey: 'rkey1', record });

      expect(mockPut).toHaveBeenCalledWith(record, 'rkey1', expect.objectContaining({ validate: true }));
    });

    it('should pass validate: false when explicitly disabled', async () => {
      const mockPut = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = mockPut;

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };

      await client.putRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        validate: false,
      });

      expect(mockPut).toHaveBeenCalledWith(record, 'rkey1', expect.objectContaining({ validate: false }));
    });

    it('should pass swapRecord CID when provided for optimistic concurrency', async () => {
      const mockPut = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = mockPut;

      const record = { $type: 'app.bsky.feed.post', text: 'updated', createdAt: '2024-01-01T00:00:00Z' };

      await client.putRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafyold',
      });

      expect(mockPut).toHaveBeenCalledWith(record, 'rkey1', {
        repo: 'did:plc:abc123',
        validate: true,
        swapRecord: 'bafyold',
      });
    });

    it('should return { uri, cid } from the XRPC response', async () => {
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecord({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
      });

      expect(result).toEqual({ uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' });
    });

    it('should wrap XrpcResponseError on conflict (409) in XrpcClientError', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockErr = new XrpcResponseError(
        { nsid: 'com.atproto.repo.putRecord' } as any,
        { status: 409, headers: new Headers() } as any,
        { body: { error: 'InvalidSwap', message: 'Record was updated by another actor' } } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockRejectedValue(mockErr);

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };

      await expect(
        client.putRecord({
          repo: 'did:plc:abc123',
          collection: 'app.bsky.feed.post',
          rkey: 'rkey1',
          record,
          swapRecord: 'bafystale',
        }),
      ).rejects.toThrow(XrpcClientError);
    });
  });

  describe('XrpcClientError', () => {
    it('should be an Error instance', () => {
      const error = new XrpcClientError('test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(XrpcClientError);
    });

    it('should expose status code when provided', () => {
      const error = new XrpcClientError('not found', { status: 404 });

      expect(error.status).toBe(404);
    });

    it('should expose cause when provided', () => {
      const cause = new Error('original');
      const error = new XrpcClientError('wrapped', { cause });

      expect(error.cause).toBe(cause);
    });
  });
});
