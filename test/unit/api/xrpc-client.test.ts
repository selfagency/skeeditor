import { describe, expect, it, vi } from 'vitest';

import { buildThreeWayMergeAdvisory, XrpcClient, XrpcClientError } from '@src/shared/api/xrpc-client';

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

    it('should reject an invalid DID format', () => {
      expect(() => new XrpcClient({ service: 'https://bsky.social', did: 'not-a-did' as never })).toThrow(
        XrpcClientError,
      );
      expect(() => new XrpcClient({ service: 'https://bsky.social', did: 'did:invalid' as never })).toThrow(
        XrpcClientError,
      );
      expect(() => new XrpcClient({ service: 'https://bsky.social', did: '123did:test' as never })).toThrow(
        XrpcClientError,
      );
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
        { encoding: 'application/json', body: { error: 'RecordNotFound', message: 'Record not found' } } as any,
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
        { encoding: 'application/json', body: { error: 'RecordNotFound', message: 'Record not found' } } as any,
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
        {
          encoding: 'application/json',
          body: { error: 'InvalidSwap', message: 'Record was updated by another actor' },
        } as any,
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

  describe('putRecordWithSwap', () => {
    it('should return a success result when the write succeeds', async () => {
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockResolvedValue({
        body: { uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1', cid: 'bafynew' },
      });

      const record = { $type: 'app.bsky.feed.post', text: 'hello', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecordWithSwap({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafyold',
      });

      expect(result).toEqual({
        success: true,
        uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1',
        cid: 'bafynew',
      });
    });

    it('should return conflict details with the latest record when swapRecord is stale', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conflictError = new XrpcResponseError(
        { nsid: 'com.atproto.repo.putRecord' } as any,
        { status: 409, headers: new Headers() } as any,
        {
          encoding: 'application/json',
          body: { error: 'InvalidSwap', message: 'Record was updated by another actor' },
        } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockRejectedValue(conflictError);
      client._client.getRecord = vi.fn().mockResolvedValue({
        body: {
          uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1',
          cid: 'bafycurrent',
          value: { $type: 'app.bsky.feed.post', text: 'latest', createdAt: '2024-01-01T00:00:00Z' },
        },
      });

      const record = { $type: 'app.bsky.feed.post', text: 'edited', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecordWithSwap({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafystale',
      });

      expect(result).toEqual({
        success: false,
        error: {
          kind: 'conflict',
          message: 'putRecord: Record was updated by another actor',
          status: 409,
        },
        conflict: {
          currentCid: 'bafycurrent',
          currentValue: { $type: 'app.bsky.feed.post', text: 'latest', createdAt: '2024-01-01T00:00:00Z' },
        },
      });
    });

    it('should map validation failures to a structured validation error result', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validationError = new XrpcResponseError(
        { nsid: 'com.atproto.repo.putRecord' } as any,
        { status: 400, headers: new Headers() } as any,
        { encoding: 'application/json', body: { error: 'InvalidRecord', message: 'Record validation failed' } } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockRejectedValue(validationError);

      const record = { $type: 'app.bsky.feed.post', text: 'bad', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecordWithSwap({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafystale',
      });

      expect(result).toEqual({
        success: false,
        error: {
          kind: 'validation',
          message: 'putRecord: Record validation failed',
          status: 400,
        },
      });
    });

    it('should map auth failures to a structured auth error result', async () => {
      const { XrpcResponseError } = await import('@atproto/lex');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authError = new XrpcResponseError(
        { nsid: 'com.atproto.repo.putRecord' } as any,
        { status: 401, headers: new Headers() } as any,
        { encoding: 'application/json', body: { error: 'AuthRequired', message: 'Authentication required' } } as any,
      );
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockRejectedValue(authError);

      const record = { $type: 'app.bsky.feed.post', text: 'bad', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecordWithSwap({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafystale',
      });

      expect(result).toEqual({
        success: false,
        error: {
          kind: 'auth',
          message: 'putRecord: Authentication required',
          status: 401,
        },
      });
    });

    it('should map transport failures without a status to a structured network error result', async () => {
      const client = new XrpcClient({ service: 'https://bsky.social' });
      client._client.putRecord = vi.fn().mockRejectedValue(new Error('socket hang up'));

      const record = { $type: 'app.bsky.feed.post', text: 'bad', createdAt: '2024-01-01T00:00:00Z' };
      const result = await client.putRecordWithSwap({
        repo: 'did:plc:abc123',
        collection: 'app.bsky.feed.post',
        rkey: 'rkey1',
        record,
        swapRecord: 'bafystale',
      });

      expect(result).toEqual({
        success: false,
        error: {
          kind: 'network',
          message: 'putRecord: socket hang up',
        },
      });
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

  describe('buildThreeWayMergeAdvisory', () => {
    it('should classify independent client and server changes as non-conflicting', () => {
      const advisory = buildThreeWayMergeAdvisory(
        { $type: 'app.bsky.feed.post', text: 'old text', langs: ['en'], createdAt: '2024-01-01T00:00:00Z' },
        { $type: 'app.bsky.feed.post', text: 'old text', langs: ['en', 'fr'], createdAt: '2024-01-01T00:00:00Z' },
        { $type: 'app.bsky.feed.post', text: 'new text', langs: ['en'], createdAt: '2024-01-01T00:00:00Z' },
      );

      expect(advisory).toEqual({
        hasConflicts: false,
        clientChanges: ['text'],
        serverChanges: ['langs'],
        sharedChanges: [],
        conflictingFields: [],
      });
    });

    it('should classify matching client/server edits as shared changes', () => {
      const advisory = buildThreeWayMergeAdvisory(
        { text: 'old text', langs: ['en'] },
        { text: 'new text', langs: ['en'] },
        { text: 'new text', langs: ['en'] },
      );

      expect(advisory).toEqual({
        hasConflicts: false,
        clientChanges: [],
        serverChanges: [],
        sharedChanges: ['text'],
        conflictingFields: [],
      });
    });

    it('should classify divergent edits to the same field as a conflict', () => {
      const advisory = buildThreeWayMergeAdvisory(
        { text: 'old text', langs: ['en'] },
        { text: 'server text', langs: ['en'] },
        { text: 'client text', langs: ['en'] },
      );

      expect(advisory).toEqual({
        hasConflicts: true,
        clientChanges: [],
        serverChanges: [],
        sharedChanges: [],
        conflictingFields: ['text'],
      });
    });

    it('should treat nested objects with different key order as equal', () => {
      const advisory = buildThreeWayMergeAdvisory(
        { embed: { a: 1, b: 2 } },
        { embed: { b: 2, a: 1 } },
        { embed: { a: 1, b: 2 } },
      );

      expect(advisory).toEqual({
        hasConflicts: false,
        clientChanges: [],
        serverChanges: [],
        sharedChanges: [],
        conflictingFields: [],
      });
    });

    it('should not stack overflow on deeply nested objects that exceed depth limit', () => {
      const buildDeep = (depth: number, leaf: unknown): Record<string, unknown> => {
        let obj: Record<string, unknown> = { value: leaf };
        for (let i = 0; i < depth; i++) {
          obj = { nested: obj };
        }
        return obj;
      };

      // Depth 20 — identical leaves should be recognized as equal
      const shallowBase = buildDeep(5, 'same');
      const shallowAttempted = buildDeep(5, 'same');
      const shallowCurrent = buildDeep(5, 'same');
      const shallowAdvisory = buildThreeWayMergeAdvisory(shallowBase, shallowAttempted, shallowCurrent);
      expect(shallowAdvisory.hasConflicts).toBe(false);

      // Depth 50 — beyond limit, identical leaves treated as unequal (safety)
      const deepBase = buildDeep(50, 'same');
      const deepAttempted = buildDeep(50, 'same');
      const deepCurrent = buildDeep(50, 'changed');

      // Should not throw regardless of depth
      expect(() => buildThreeWayMergeAdvisory(deepBase, deepAttempted, deepCurrent)).not.toThrow();
    });
  });
});
