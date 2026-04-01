/**
 * Integration test: XrpcClient.putRecord against the real devnet PDS.
 *
 * This test runs the exact same code path as the browser extension —
 * using our XrpcClient wrapper directly — to verify that edits actually reach
 * the PDS with the updated createdAt field.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AtpAgent } from '@atproto/api';
import { loadAccounts, PDS_URL } from './setup.js';
import { XrpcClient } from '../../src/shared/api/xrpc-client.js';

describe('XrpcClient putRecord against devnet PDS', () => {
  let agent: AtpAgent;
  let did: string;
  let accessToken: string;
  let rkey: string;
  let originalCid: string;
  const originalCreatedAt = '2020-01-01T00:00:00.000Z';

  beforeAll(async () => {
    const accounts = loadAccounts();
    agent = new AtpAgent({ service: PDS_URL });
    await agent.login({
      identifier: accounts.ALICE_HANDLE,
      password: accounts.ALICE_PASSWORD,
    });
    did = agent.session!.did;
    accessToken = agent.session!.accessJwt;

    // Create a test post with a known past createdAt so we can verify it changes.
    const res = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: 'xrpc-client-put-record integration test — original',
        createdAt: originalCreatedAt,
      },
    });
    rkey = res.data.uri.split('/').pop()!;
    originalCid = res.data.cid;
  });

  it('putRecord sends the updated record body including new createdAt to the PDS', async () => {
    const client = new XrpcClient({
      service: PDS_URL,
      did,
      accessJwt: accessToken,
    });

    const newCreatedAt = new Date().toISOString();
    const updatedRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'xrpc-client-put-record integration test — edited',
      createdAt: newCreatedAt,
    };

    const result = await client.putRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      rkey,
      record: updatedRecord,
      swapRecord: originalCid,
    });

    expect(result.uri).toContain(rkey);
    expect(result.cid).toBeDefined();
    expect(result.cid).not.toBe(originalCid);

    // Read the record back from the PDS and verify createdAt was persisted.
    const getRes = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      rkey,
    });

    const savedRecord = getRes.data.value as { text: string; createdAt: string };
    expect(savedRecord.text).toBe('xrpc-client-put-record integration test — edited');
    expect(savedRecord.createdAt).toBe(newCreatedAt);
    expect(savedRecord.createdAt).not.toBe(originalCreatedAt);
  });
});
