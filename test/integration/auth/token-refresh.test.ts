import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { refreshAccessToken } from '@src/shared/auth/token-refresh';
import { server } from '../../mocks/server';

const TOKEN_ENDPOINT = 'https://bsky.social/oauth/token';
const CLIENT_ID = 'https://example.com/client-metadata.json';
const REFRESH_TOKEN = 'rt_valid_token';

describe('refreshAccessToken', () => {
  it('should POST to the token endpoint with grant_type=refresh_token and return a token response', async () => {
    const mockResponse = {
      access_token: 'at_new_token',
      token_type: 'DPoP',
      expires_in: 3600,
      refresh_token: 'rt_new_token',
      scope: 'atproto transition:generic',
      sub: 'did:plc:abc123',
    };

    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        return HttpResponse.json(mockResponse);
      }),
    );

    const result = await refreshAccessToken(TOKEN_ENDPOINT, REFRESH_TOKEN, CLIENT_ID);

    expect(result.access_token).toBe(mockResponse.access_token);
    expect(result.refresh_token).toBe(mockResponse.refresh_token);
    expect(result.sub).toBe(mockResponse.sub);
  });

  it('should include grant_type=refresh_token, refresh_token, and client_id in the POST body', async () => {
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.post(TOKEN_ENDPOINT, async ({ request }) => {
        capturedParams = new URLSearchParams(await request.text());
        return HttpResponse.json({ access_token: 'token', token_type: 'Bearer' });
      }),
    );

    await refreshAccessToken(TOKEN_ENDPOINT, REFRESH_TOKEN, CLIENT_ID);

    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.get('grant_type')).toBe('refresh_token');
    expect(capturedParams!.get('refresh_token')).toBe(REFRESH_TOKEN);
    expect(capturedParams!.get('client_id')).toBe(CLIENT_ID);
  });

  it('should throw AuthClientError when the token endpoint returns an error', async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        return HttpResponse.json(
          { error: 'invalid_grant', error_description: 'Refresh token expired' },
          { status: 400 },
        );
      }),
    );

    await expect(refreshAccessToken(TOKEN_ENDPOINT, 'expired_rt', CLIENT_ID)).rejects.toThrow(
      'Refresh token expired',
    );
  });
});
