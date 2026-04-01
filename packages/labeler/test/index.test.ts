import { describe, expect, it, vi } from 'vitest';

import worker from '../src/index.ts';
import { serveDidDocument } from '../src/did-document.ts';
import type { Env } from '../src/types.ts';

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  BROADCAST_HUB: {
    idFromName: vi.fn().mockReturnValue({}),
    get: vi.fn(),
  } as unknown as DurableObjectNamespace,
  LABELS_KV: {} as KVNamespace,
  LABELER_DID: 'did:plc:m6h36r2hzbnozuhxj4obhkyb',
  LABELER_HANDLE: 'skeeditor.link',
  LABELER_SERVICE_URL: 'https://labeler.skeeditor.link',
  LABELER_PUBLIC_KEY_MULTIBASE: 'zQ3shtSrUuoZLm2nz6mwUrh3H3qDyZpbqxDVwim4SjktNrKe2',
  ...overrides,
});

describe('labeler worker routes', () => {
  it('answers CORS preflight for emitLabel with DPoP allowed', async () => {
    const response = await worker.fetch(
      new Request('https://labeler.skeeditor.link/xrpc/tools.skeeditor.emitLabel', {
        method: 'OPTIONS',
        headers: {
          Origin: 'chrome-extension://test-extension',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type, dpop',
        },
      }),
      makeEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('DPoP');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('dpop');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('serves getServices with a detailed view for the configured labeler DID', async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request(
        `https://labeler.skeeditor.link/xrpc/app.bsky.labeler.getServices?dids=${encodeURIComponent(env.LABELER_DID)}&detailed=true`,
      ),
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { views: Array<Record<string, unknown>> };
    expect(body.views).toHaveLength(1);
    expect(body.views[0]).toMatchObject({
      creator: expect.objectContaining({ did: env.LABELER_DID, handle: env.LABELER_HANDLE }),
      policies: expect.objectContaining({ labelValues: ['edited'] }),
      subjectTypes: ['record'],
      subjectCollections: ['app.bsky.feed.post'],
    });
  });

  it('returns an empty views list when the requested DID does not match this labeler', async () => {
    const response = await worker.fetch(
      new Request('https://labeler.skeeditor.link/xrpc/app.bsky.labeler.getServices?dids=did:plc:someoneelse'),
      makeEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ views: [] });
  });

  it('forwards Authorization and DPoP headers to the hub emit route', async () => {
    const hubFetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const env = makeEnv({
      BROADCAST_HUB: {
        idFromName: vi.fn().mockReturnValue({}),
        get: vi.fn().mockReturnValue({ fetch: hubFetch }),
      } as unknown as DurableObjectNamespace,
    });

    const response = await worker.fetch(
      new Request('https://labeler.skeeditor.link/xrpc/tools.skeeditor.emitLabel', {
        method: 'POST',
        headers: {
          Authorization: 'DPoP token-123',
          DPoP: 'proof-abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uri: `at://${env.LABELER_DID}/app.bsky.feed.post/abc`,
          cid: 'bafy123',
          did: env.LABELER_DID,
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(hubFetch).toHaveBeenCalledOnce();

    const [forwarded] = hubFetch.mock.calls[0] ?? [];
    expect(forwarded).toBeInstanceOf(Request);
    expect((forwarded as Request).headers.get('Authorization')).toBe('DPoP token-123');
    expect((forwarded as Request).headers.get('DPoP')).toBe('proof-abc');
  });
});

describe('serveDidDocument', () => {
  it('uses the configured service URL and fallback public key', async () => {
    const env = makeEnv();
    const response = serveDidDocument(env);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      verificationMethod: Array<{ publicKeyMultibase: string }>;
      service: Array<{ serviceEndpoint: string }>;
    };

    expect(body.verificationMethod[0]?.publicKeyMultibase).toBe(env.LABELER_PUBLIC_KEY_MULTIBASE);
    expect(body.service[0]?.serviceEndpoint).toBe(env.LABELER_SERVICE_URL);
  });

  it('derives the public key from LABELER_SIGNING_KEY when present', async () => {
    const response = serveDidDocument(
      makeEnv({
        LABELER_SIGNING_KEY: '1111111111111111111111111111111111111111111111111111111111111111',
        LABELER_PUBLIC_KEY_MULTIBASE: 'zFallbackShouldNotWin',
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { verificationMethod: Array<{ publicKeyMultibase: string }> };
    expect(body.verificationMethod[0]?.publicKeyMultibase).toMatch(/^z/);
    expect(body.verificationMethod[0]?.publicKeyMultibase).not.toBe('zFallbackShouldNotWin');
  });

  it('fails fast when no public key configuration is available', async () => {
    const env = makeEnv();
    delete env.LABELER_PUBLIC_KEY_MULTIBASE;
    delete env.LABELER_SIGNING_KEY;

    const response = serveDidDocument(env);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Labeler public key is not configured. Provide LABELER_SIGNING_KEY or LABELER_PUBLIC_KEY_MULTIBASE.',
    });
  });

  it('falls back to LABELER_PUBLIC_KEY_MULTIBASE when signing-key derivation fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = serveDidDocument(
      makeEnv({
        LABELER_SIGNING_KEY: 'not-a-valid-private-key',
        LABELER_PUBLIC_KEY_MULTIBASE: 'zFallbackPublicKeyWins',
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { verificationMethod: Array<{ publicKeyMultibase: string }> };
    expect(body.verificationMethod[0]?.publicKeyMultibase).toBe('zFallbackPublicKeyWins');
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
