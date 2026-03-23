import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { AppPasswordAuthError, authenticateWithAppPassword } from '@src/shared/auth/app-password';
import { server } from '../../mocks/server';

const PDS_URL = 'https://bsky.social';
const LOGIN_URL = `${PDS_URL}/xrpc/com.atproto.server.createSession`;

const MOCK_SESSION = {
  accessJwt: 'eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJkaWQ6cGxjOmFiYzEyMyJ9.sig',
  refreshJwt: 'eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJkaWQ6cGxjOnJlZnJlc2gifQ.sig',
  did: 'did:plc:abc123',
  handle: 'user.bsky.social',
};

describe('authenticateWithAppPassword (integration)', () => {
  it('should complete the full login flow and return session tokens', async () => {
    server.use(
      http.post(LOGIN_URL, () => {
        return HttpResponse.json(MOCK_SESSION);
      }),
    );

    const result = await authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'MyTestPass1');

    expect(result.accessToken).toBe(MOCK_SESSION.accessJwt);
    expect(result.refreshToken).toBe(MOCK_SESSION.refreshJwt);
    expect(result.did).toBe(MOCK_SESSION.did);
  });

  it('should set expiresAt approximately 30 days in the future', async () => {
    server.use(
      http.post(LOGIN_URL, () => {
        return HttpResponse.json(MOCK_SESSION);
      }),
    );

    const before = Date.now();
    const { expiresAt } = await authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'MyTestPass1');
    const after = Date.now();

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });

  it('should throw AppPasswordAuthError when the PDS returns 401', async () => {
    server.use(
      http.post(LOGIN_URL, () => {
        return HttpResponse.json({ error: 'AuthenticationRequired' }, { status: 401 });
      }),
    );

    await expect(authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'WrongPass1')).rejects.toBeInstanceOf(
      AppPasswordAuthError,
    );
  });

  it('should include the HTTP status code on the error when authentication fails', async () => {
    server.use(
      http.post(LOGIN_URL, () => {
        return HttpResponse.json({ error: 'AuthenticationRequired' }, { status: 401 });
      }),
    );

    const err = await authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'WrongPass1').catch(e => e);

    expect((err as AppPasswordAuthError).status).toBe(401);
  });

  it('should propagate the server error message when the PDS returns one', async () => {
    server.use(
      http.post(LOGIN_URL, () => {
        return HttpResponse.json({ error: 'AccountTakedown' }, { status: 401 });
      }),
    );

    const err = await authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'MyTestPass1').catch(e => e);

    expect((err as AppPasswordAuthError).message).toBe('AccountTakedown');
  });

  it('should send the identifier and password in the request body', async () => {
    let capturedBody: Record<string, string> | null = null;

    server.use(
      http.post(LOGIN_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json(MOCK_SESSION);
      }),
    );

    await authenticateWithAppPassword(PDS_URL, 'user.bsky.social', 'MyTestPass1');

    expect(capturedBody).toEqual({ identifier: 'user.bsky.social', password: 'MyTestPass1' });
  });
});
