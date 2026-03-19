import { describe, expect, it } from 'vitest';

import { buildAuthorizationRequest, parseCallbackParams } from '@src/shared/auth/auth-client';
import { deriveCodeChallenge } from '@src/shared/auth/pkce';

const BASE_PARAMS = {
  clientId: 'https://example.com/client-metadata.json',
  redirectUri: 'https://example.com/callback',
  scope: 'atproto transition:generic',
  authorizationEndpoint: 'https://bsky.social/oauth/authorize',
};

describe('buildAuthorizationRequest', () => {
  it('should return a url, state, and codeVerifier', async () => {
    const request = await buildAuthorizationRequest(BASE_PARAMS);

    expect(request.url).toBeTruthy();
    expect(request.state).toBeTruthy();
    expect(request.codeVerifier).toBeTruthy();
  });

  it('should set response_type to code', async () => {
    const { url } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('should include client_id in the URL', async () => {
    const { url } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('client_id')).toBe(BASE_PARAMS.clientId);
  });

  it('should include redirect_uri in the URL', async () => {
    const { url } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('redirect_uri')).toBe(BASE_PARAMS.redirectUri);
  });

  it('should include scope in the URL', async () => {
    const { url } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('scope')).toBe(BASE_PARAMS.scope);
  });

  it('should set code_challenge_method to S256', async () => {
    const { url } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should include a code_challenge that matches the derived challenge of the returned verifier', async () => {
    const { url, codeVerifier } = await buildAuthorizationRequest(BASE_PARAMS);

    const challenge = new URL(url).searchParams.get('code_challenge');
    const expected = await deriveCodeChallenge(codeVerifier);

    expect(challenge).toBe(expected);
  });

  it('should embed the returned state in the URL', async () => {
    const { url, state } = await buildAuthorizationRequest(BASE_PARAMS);

    expect(new URL(url).searchParams.get('state')).toBe(state);
  });

  it('should produce a different state on each call', async () => {
    const r1 = await buildAuthorizationRequest(BASE_PARAMS);
    const r2 = await buildAuthorizationRequest(BASE_PARAMS);

    expect(r1.state).not.toBe(r2.state);
  });
});

describe('parseCallbackParams', () => {
  it('should extract code and state from a valid callback URL', () => {
    const url = 'https://example.com/callback?code=auth_code_123&state=random_state';

    const result = parseCallbackParams(url);

    expect(result).toEqual({ code: 'auth_code_123', state: 'random_state' });
  });

  it('should return error and errorDescription when the error param is present', () => {
    const url = 'https://example.com/callback?error=access_denied&error_description=User+denied';

    const result = parseCallbackParams(url);

    expect(result).toHaveProperty('error', 'access_denied');
    expect(result).toHaveProperty('errorDescription', 'User denied');
  });

  it('should return error when code is missing', () => {
    const url = 'https://example.com/callback?state=some_state';

    const result = parseCallbackParams(url);

    expect('error' in result).toBe(true);
  });

  it('should return error when state is missing', () => {
    const url = 'https://example.com/callback?code=auth_code_123';

    const result = parseCallbackParams(url);

    expect('error' in result).toBe(true);
  });
});
