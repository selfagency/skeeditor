import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { XrpcClient, XrpcClientError } from '@src/shared/api/xrpc-client';
import { BSKY_PDS_URL } from '@src/shared/constants';
import { server } from '../../mocks/server';

const TEST_DID = 'did:plc:testuser123';
const TEST_COLLECTION = 'app.bsky.feed.post';
const TEST_RKEY = '3kq2abcxyz';
const TEST_AT_URI = `at://${TEST_DID}/${TEST_COLLECTION}/${TEST_RKEY}`;
const TEST_CID = 'bafyreie5737gdxxxlu5vc6bqczpwjrkbz3iezahmcvtjpggsomvzsjj7gu';
const TEST_VALUE = {
  $type: 'app.bsky.feed.post',
  text: 'Hello, Bluesky!',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('XrpcClient integration flow', () => {
  let client: XrpcClient;

  beforeEach(() => {
    client = new XrpcClient({
      service: BSKY_PDS_URL,
      did: TEST_DID,
      accessJwt: 'test-jwt-token',
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('getRecord', () => {
    it('should resolve a mocked getRecord XRPC response', async () => {
      server.use(
        http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () => {
          return HttpResponse.json({
            uri: TEST_AT_URI,
            cid: TEST_CID,
            value: TEST_VALUE,
          });
        }),
      );

      const result = await client.getRecord({
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
      });

      expect(result.cid).toBe(TEST_CID);
      expect(result.value).toEqual(TEST_VALUE);
    });

    it('should throw XrpcClientError on 404 response from getRecord', async () => {
      server.use(
        http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () => {
          return HttpResponse.json({ error: 'RecordNotFound', message: 'Record not found' }, { status: 404 });
        }),
      );

      await expect(client.getRecord({ repo: TEST_DID, collection: TEST_COLLECTION, rkey: 'missing' })).rejects.toThrow(
        XrpcClientError,
      );
    });

    it('should report the HTTP status on the thrown XrpcClientError', async () => {
      server.use(
        http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () => {
          return HttpResponse.json({ error: 'RecordNotFound', message: 'Record not found' }, { status: 404 });
        }),
      );

      let error!: XrpcClientError;
      await client.getRecord({ repo: TEST_DID, collection: TEST_COLLECTION, rkey: 'missing' }).catch((e: unknown) => {
        error = e as XrpcClientError;
      });

      expect(error.status).toBe(404);
    });
  });

  describe('putRecord', () => {
    it('should resolve a mocked putRecord XRPC response', async () => {
      const newCid = 'bafyreigxspcnjypynb3lelh5gdflrwb6ygmwytlzdhrwoxhwj3vb5l7oeq';
      server.use(
        http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () => {
          return HttpResponse.json({ uri: TEST_AT_URI, cid: newCid });
        }),
      );

      const result = await client.putRecord({
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_VALUE, text: 'Updated text!' },
      });

      expect(result.uri).toBe(TEST_AT_URI);
      expect(result.cid).toBe(newCid);
    });

    it('should throw XrpcClientError on 409 InvalidSwap (swapRecord conflict)', async () => {
      server.use(
        http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () => {
          return HttpResponse.json(
            { error: 'InvalidSwap', message: 'Record was updated by another actor' },
            { status: 409 },
          );
        }),
      );

      await expect(
        client.putRecord({
          repo: TEST_DID,
          collection: TEST_COLLECTION,
          rkey: TEST_RKEY,
          record: TEST_VALUE,
          swapRecord: 'bafystale',
        }),
      ).rejects.toThrow(XrpcClientError);
    });

    it('should report status 409 on the thrown XrpcClientError for conflicts', async () => {
      server.use(
        http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () => {
          return HttpResponse.json(
            { error: 'InvalidSwap', message: 'Record was updated by another actor' },
            { status: 409 },
          );
        }),
      );

      let error!: XrpcClientError;
      await client
        .putRecord({
          repo: TEST_DID,
          collection: TEST_COLLECTION,
          rkey: TEST_RKEY,
          record: TEST_VALUE,
          swapRecord: 'bafystale',
        })
        .catch((e: unknown) => {
          error = e as XrpcClientError;
        });

      expect(error.status).toBe(409);
    });

    it('should return a structured conflict result with latest record details', async () => {
      server.use(
        http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () => {
          return HttpResponse.json(
            { error: 'InvalidSwap', message: 'Record was updated by another actor' },
            { status: 409 },
          );
        }),
        http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () => {
          return HttpResponse.json({
            uri: TEST_AT_URI,
            cid: 'bafyrelatest',
            value: { ...TEST_VALUE, text: 'Latest server text' },
          });
        }),
      );

      const result = await client.putRecordWithSwap({
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_VALUE, text: 'Edited locally' },
        swapRecord: 'bafystale',
      });

      expect(result).toEqual({
        success: false,
        error: {
          kind: 'conflict',
          message: `putRecord(${TEST_DID}/${TEST_COLLECTION}/${TEST_RKEY}): Record was updated by another actor`,
          status: 409,
        },
      });
    });
  });

  describe('full read-modify-write flow', () => {
    it('should getRecord, modify text, and putRecord in sequence', async () => {
      const newCid = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a';
      const updatedText = 'Edited text!';

      server.use(
        http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () => {
          return HttpResponse.json({ uri: TEST_AT_URI, cid: TEST_CID, value: TEST_VALUE });
        }),
        http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () => {
          return HttpResponse.json({ uri: TEST_AT_URI, cid: newCid });
        }),
      );

      // Read
      const { value, cid } = await client.getRecord({
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
      });

      // Modify (preserve all fields)
      const updatedRecord = { ...value, text: updatedText } as unknown as Record<string, unknown> & { $type: string };

      // Write
      const writeResult = await client.putRecord({
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: updatedRecord,
        swapRecord: cid,
      });

      expect(writeResult.cid).toBe(newCid);
    });
  });
});
