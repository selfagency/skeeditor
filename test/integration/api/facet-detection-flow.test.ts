import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { XrpcClient } from '@src/shared/api/xrpc-client';
import { BSKY_PDS_URL } from '@src/shared/constants';
import { buildFacets } from '@src/shared/utils/facets';
import { server } from '../../mocks/server';

const TEST_DID = 'did:plc:facetflow123';
const TEST_COLLECTION = 'app.bsky.feed.post';
const TEST_RKEY = '3kq2facetflow';
const TEST_AT_URI = `at://${TEST_DID}/${TEST_COLLECTION}/${TEST_RKEY}`;
const NEW_CID = 'bafyreiaxn2x4f2e5r6sqgup5vwwz3x4r6v7g2u3eqik5lnk52lsf4swqoe';

describe('facet detection integration flow', () => {
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

  it('should detect facets and send them in putRecord request body', async () => {
    const text = 'Hi 😀 https://example.com #日本語';
    const facets = buildFacets(text);
    let capturedRecord: Record<string, unknown> | null = null;

    server.use(
      http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, async ({ request }) => {
        const body = (await request.json()) as {
          record: Record<string, unknown>;
        };

        capturedRecord = body.record;
        return HttpResponse.json({ uri: TEST_AT_URI, cid: NEW_CID });
      }),
    );

    const result = await client.putRecord({
      repo: TEST_DID,
      collection: TEST_COLLECTION,
      rkey: TEST_RKEY,
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: '2024-01-01T00:00:00.000Z',
        facets,
      },
    });

    expect(result.cid).toBe(NEW_CID);
    expect(capturedRecord).toMatchObject({
      text,
      facets,
    });
  });
});
