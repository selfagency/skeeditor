import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { exchangeCodeForTokens } from '@src/shared/auth/auth-client';
import { generateCodeVerifier } from '@src/shared/auth/pkce';
import { server } from '../../mocks/server';

const TOKEN_ENDPOINT = 'https://bsky.social/oauth/token';
const CLIENT_ID = 'https://example.com/client-metadata.json';
const REDIRECT_URI = 'https://example.com/callback';

describe('exchangeCodeForTokens', () => {
  it('should POST to the token endpoint and return a token response', async () => {
    const mockResponse = {
      access_token: 'at_mock_token',
      token_type: 'DPoP',
      expires_in: 3600,
      refresh_token: 'rt_mock_token',
      scope: 'atproto transition:generic',
      sub: 'did:plc:abc123',
    };

    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        return HttpResponse.json(mockResponse);
      }),
    );

    const verifier = generateCodeVerifier();

    const result = await exchangeCodeForTokens(TOKEN_ENDPOINT, 'auth_code', verifier, CLIENT_ID, REDIRECT_URI);

    expect(result.access_token).toBe(mockResponse.access_token);
    expect(result.token_type).toBe(mockResponse.token_type);
    expect(result.refresh_token).toBe(mockResponse.refresh_token);
    expect(result.sub).toBe(mockResponse.sub);
  });

  it('should include grant_type, code, code_verifier, client_id, and redirect_uri in the POST body', async () => {
    let capturedParams: URLSearchParams | null = null;
    const verifier = generateCodeVerifier();

    server.use(
      http.post(TOKEN_ENDPOINT, async ({ request }) => {
        capturedParams = new URLSearchParams(await request.text());
        return HttpResponse.json({ access_token: 'token', token_type: 'Bearer' });
      }),
    );

    await exchangeCodeForTokens(TOKEN_ENDPOINT, 'code_xyz', verifier, CLIENT_ID, REDIRECT_URI);

    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.get('grant_type')).toBe('authorization_code');
    expect(capturedParams!.get('code')).toBe('code_xyz');
    expect(capturedParams!.get('code_verifier')).toBe(verifier);
    expect(capturedParams!.get('client_id')).toBe(CLIENT_ID);
    expect(capturedParams!.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('should throw when the token endpoint returns an HTTP error', async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        return HttpResponse.json({ error: 'invalid_grant', error_description: 'Code expired' }, { status: 400 });
      }),
    );

    const verifier = generateCodeVerifier();

    await expect(
      exchangeCodeForTokens(TOKEN_ENDPOINT, 'expired_code', verifier, CLIENT_ID, REDIRECT_URI),
    ).rejects.toThrow('Code expired');
  });
});
