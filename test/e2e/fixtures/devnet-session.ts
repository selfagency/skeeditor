/**
 * test/e2e/fixtures/devnet-session.ts
 *
 * Helpers for creating real AT Protocol sessions against the devnet PDS.
 * Used by devnet E2E fixture files to authenticate Alice/Bob and inject
 * their JWTs directly into extension storage (bypassing the OAuth popup).
 */

export interface PdsSession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  pdsUrl: string;
}

/**
 * Authenticate with the devnet PDS via com.atproto.server.createSession.
 *
 * @throws if the PDS returns a non-200 response.
 */
export async function createPdsSession(handle: string, password: string, pdsUrl: string): Promise<PdsSession> {
  const url = `${pdsUrl}/xrpc/com.atproto.server.createSession`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`createSession failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
  };

  return { did: data.did, handle: data.handle, accessJwt: data.accessJwt, refreshJwt: data.refreshJwt, pdsUrl };
}
