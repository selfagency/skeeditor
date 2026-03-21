import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppPasswordAuthError,
  authenticateWithAppPassword,
  maskAppPassword,
  validateAppPassword,
} from '@src/shared/auth/app-password';

// ---------------------------------------------------------------------------
// validateAppPassword
// ---------------------------------------------------------------------------

describe('validateAppPassword', () => {
  it('should accept a password with letters and numbers', () => {
    expect(validateAppPassword('abc12345')).toBe(true);
  });

  it('should accept a password with mixed case letters and numbers', () => {
    expect(validateAppPassword('MyPass1word')).toBe(true);
  });

  it('should accept a password with special characters if it has letters and numbers', () => {
    expect(validateAppPassword('abc1-def-ghi')).toBe(true);
  });

  it('should reject a password shorter than 8 characters', () => {
    expect(validateAppPassword('abc1')).toBe(false);
  });

  it('should reject a password longer than 128 characters', () => {
    expect(validateAppPassword('a'.repeat(64) + '1'.repeat(65))).toBe(false);
  });

  it('should reject a password with only letters', () => {
    expect(validateAppPassword('abcdefgh')).toBe(false);
  });

  it('should reject a password with only numbers', () => {
    expect(validateAppPassword('12345678')).toBe(false);
  });

  it('should accept exactly 8 characters when valid', () => {
    expect(validateAppPassword('abcde123')).toBe(true);
  });

  it('should accept exactly 128 characters when valid', () => {
    expect(validateAppPassword('a'.repeat(64) + '1'.repeat(64))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// maskAppPassword
// ---------------------------------------------------------------------------

describe('maskAppPassword', () => {
  it('should mask a typical password showing first 4 and last 4 chars', () => {
    const result = maskAppPassword('abcd5678efgh');

    expect(result).toBe('abcd••••efgh');
  });

  it('should fully mask a password of exactly 8 characters', () => {
    const result = maskAppPassword('abcd1234');

    expect(result).toBe('••••••••');
  });

  it('should fully mask a password shorter than 8 characters', () => {
    const result = maskAppPassword('abc1');

    expect(result).toBe('••••');
  });

  it('should produce the correct number of bullet characters for a long password', () => {
    const password = 'abcd' + 'x'.repeat(10) + '1234';
    const result = maskAppPassword(password);

    expect(result).toBe('abcd' + '•'.repeat(10) + '1234');
  });

  it('should handle a password of 9 characters (one bullet in the middle)', () => {
    const result = maskAppPassword('abcd1234z');

    expect(result).toBe('abcd•234z');
  });
});

// ---------------------------------------------------------------------------
// authenticateWithAppPassword
// ---------------------------------------------------------------------------

const PDS_URL = 'https://bsky.social';
const IDENTIFIER = 'user.bsky.social';
const PASSWORD = 'MyTestPass1';

const MOCK_LOGIN_RESPONSE = {
  accessJwt: 'eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJkaWQ6cGxjOmFiYzEyMyJ9.sig',
  refreshJwt: 'eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJkaWQ6cGxjOnJlZnJlc2gifQ.sig',
  did: 'did:plc:abc123',
  handle: 'user.bsky.social',
};

describe('authenticateWithAppPassword', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call the PDS createSession endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(global.fetch).toHaveBeenCalledWith(
      `${PDS_URL}/xrpc/com.atproto.server.createSession`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should POST JSON with identifier and password', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), { status: 200 }));

    await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    const [, init] = vi.mocked(global.fetch).mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string) as unknown;

    expect(body).toEqual({ identifier: IDENTIFIER, password: PASSWORD });
  });

  it('should return an accessToken matching the response accessJwt', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), { status: 200 }));

    const result = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(result.accessToken).toBe(MOCK_LOGIN_RESPONSE.accessJwt);
  });

  it('should return a refreshToken matching the response refreshJwt', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), { status: 200 }));

    const result = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(result.refreshToken).toBe(MOCK_LOGIN_RESPONSE.refreshJwt);
  });

  it('should return the DID from the response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), { status: 200 }));

    const result = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(result.did).toBe(MOCK_LOGIN_RESPONSE.did);
  });

  it('should return an expiresAt in the future', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify(MOCK_LOGIN_RESPONSE), { status: 200 }));

    const before = Date.now();
    const result = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(result.expiresAt).toBeGreaterThan(before);
  });

  it('should handle a response without a refreshJwt', async () => {
    const responseWithoutRefresh = { ...MOCK_LOGIN_RESPONSE, refreshJwt: undefined };
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(responseWithoutRefresh), { status: 200 }),
    );

    const result = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD);

    expect(result.refreshToken).toBeUndefined();
  });

  it('should throw AppPasswordAuthError on a 401 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'AuthenticationRequired' }), { status: 401 }),
    );

    await expect(authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD)).rejects.toThrow(AppPasswordAuthError);
  });

  it('should include the HTTP status on the thrown error for a 401', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'AuthenticationRequired' }), { status: 401 }),
    );

    const err = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD).catch(e => e);

    expect(err).toBeInstanceOf(AppPasswordAuthError);
    expect((err as AppPasswordAuthError).status).toBe(401);
  });

  it('should use the server error message when available', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'InvalidPassword' }), { status: 400 }),
    );

    const err = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD).catch(e => e);

    expect((err as AppPasswordAuthError).message).toBe('InvalidPassword');
  });

  it('should fall back to a generic message when no error field in body', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));

    const err = await authenticateWithAppPassword(PDS_URL, IDENTIFIER, PASSWORD).catch(e => e);

    expect((err as AppPasswordAuthError).message).toMatch(/500/);
  });
});
