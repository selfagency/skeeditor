import { describe, expect, it } from 'vitest';

import { buildDidWebUrl, DidResolutionError } from '@src/shared/api/resolve-did';

describe('buildDidWebUrl', () => {
  it('should resolve a root did:web to /.well-known/did.json', () => {
    expect(buildDidWebUrl('did:web:example.com')).toBe('https://example.com/.well-known/did.json');
  });

  it('should resolve a path-based did:web to /path/did.json', () => {
    expect(buildDidWebUrl('did:web:example.com:user:alice')).toBe('https://example.com/user/alice/did.json');
  });

  it('should resolve a single-segment path did:web', () => {
    expect(buildDidWebUrl('did:web:example.com:users')).toBe('https://example.com/users/did.json');
  });

  it('should decode a percent-encoded port in the host segment', () => {
    expect(buildDidWebUrl('did:web:example.com%3A8080')).toBe('https://example.com:8080/.well-known/did.json');
  });

  it('should decode a percent-encoded port in the host with a path', () => {
    expect(buildDidWebUrl('did:web:example.com%3A8080:user:alice')).toBe(
      'https://example.com:8080/user/alice/did.json',
    );
  });

  it('should decode percent-encoded characters in path segments', () => {
    expect(buildDidWebUrl('did:web:example.com:my%20org')).toBe('https://example.com/my org/did.json');
  });

  it('should throw DidResolutionError with the did attached for an empty identifier', () => {
    const emptyDid = 'did:web:';
    expect(() => buildDidWebUrl(emptyDid)).toThrow(DidResolutionError);
    let caught: unknown;
    try {
      buildDidWebUrl(emptyDid);
    } catch (err) {
      caught = err;
    }
    expect((caught as DidResolutionError).did).toBe(emptyDid);
  });

  it('should throw DidResolutionError when passed a non-did:web identifier', () => {
    expect(() => buildDidWebUrl('did:plc:abc123')).toThrow(DidResolutionError);
  });
});
