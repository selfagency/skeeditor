import { describe, expect, it } from 'vitest';

import { deriveCodeChallenge, generateCodeVerifier, generateState } from '@src/shared/auth/pkce';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

describe('generateCodeVerifier', () => {
  it('should return only base64url-safe characters', () => {
    const verifier = generateCodeVerifier();

    expect(verifier).toMatch(BASE64URL_PATTERN);
  });

  it('should return a string of at least 43 characters', () => {
    // RFC 7636 §4.1: code_verifier must be 43–128 chars; 32 bytes base64url = 43 chars
    const verifier = generateCodeVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('should produce a different value on each call', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();

    expect(v1).not.toBe(v2);
  });
});

describe('deriveCodeChallenge', () => {
  it('should return a non-empty string', async () => {
    const verifier = generateCodeVerifier();

    const challenge = await deriveCodeChallenge(verifier);

    expect(challenge.length).toBeGreaterThan(0);
  });

  it('should return a 43-character base64url-encoded SHA-256 hash', async () => {
    // SHA-256 = 32 bytes; ceil(32 * 4/3) = 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();

    const challenge = await deriveCodeChallenge(verifier);

    expect(challenge.length).toBe(43);
  });

  it('should be deterministic for the same input', async () => {
    const verifier = generateCodeVerifier();

    const c1 = await deriveCodeChallenge(verifier);
    const c2 = await deriveCodeChallenge(verifier);

    expect(c1).toBe(c2);
  });

  it('should produce different outputs for different inputs', async () => {
    const c1 = await deriveCodeChallenge(generateCodeVerifier());
    const c2 = await deriveCodeChallenge(generateCodeVerifier());

    expect(c1).not.toBe(c2);
  });

  it('should return only base64url-safe characters', async () => {
    const verifier = generateCodeVerifier();

    const challenge = await deriveCodeChallenge(verifier);

    expect(challenge).toMatch(BASE64URL_PATTERN);
  });
});

describe('generateState', () => {
  it('should return a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('should produce different values on each call', () => {
    const s1 = generateState();
    const s2 = generateState();

    expect(s1).not.toBe(s2);
  });

  it('should return only base64url-safe characters', () => {
    expect(generateState()).toMatch(BASE64URL_PATTERN);
  });
});
