/**
 * test/e2e/fixtures/devnet-records.ts
 *
 * Helpers for creating and deleting real app.bsky.feed.post records on the
 * devnet PDS, used to exercise the extension's edit/save flow end-to-end.
 */
import type { PdsSession } from './devnet-session';

export interface DevnetPost {
  uri: string;
  cid: string;
  rkey: string;
  text: string;
  did: string;
  pdsUrl: string;
}

/**
 * Create a real post record on the devnet PDS.
 *
 * Returns the AT-URI, CID, rkey, and the original text for verification.
 */
export async function createDevnetPost(session: PdsSession, text: string): Promise<DevnetPost> {
  const url = `${session.pdsUrl}/xrpc/com.atproto.repo.createRecord`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`createRecord failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { uri: string; cid: string };
  const rkey = data.uri.split('/').pop() ?? '';

  return { uri: data.uri, cid: data.cid, rkey, text, did: session.did, pdsUrl: session.pdsUrl };
}

/**
 * Fetch the current text of a post from the devnet PDS.
 */
export async function getDevnetPostText(session: PdsSession, did: string, rkey: string): Promise<string> {
  const params = new URLSearchParams({ repo: did, collection: 'app.bsky.feed.post', rkey });
  const url = `${session.pdsUrl}/xrpc/com.atproto.repo.getRecord?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`getRecord failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { value: { text: string } };
  return data.value.text;
}

/**
 * Delete a post record from the devnet PDS.
 */
export async function deleteDevnetPost(session: PdsSession, did: string, rkey: string): Promise<void> {
  const url = `${session.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', rkey }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`deleteRecord failed (${response.status}): ${body}`);
  }
}

/**
 * Update a post record externally on the devnet PDS (for conflict tests).
 * Uses putRecord without a swap CID to force an unconditional write.
 */
export async function updateDevnetPostExternal(
  session: PdsSession,
  did: string,
  rkey: string,
  newText: string,
): Promise<void> {
  const url = `${session.pdsUrl}/xrpc/com.atproto.repo.putRecord`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      rkey,
      record: {
        $type: 'app.bsky.feed.post',
        text: newText,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`putRecord (external update) failed (${response.status}): ${body}`);
  }
}
