import browser from 'webextension-polyfill';

const DPOP_KEY_STORAGE = 'dpopKey';

interface StoredDpopKey {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Load the persisted DPoP key pair from extension storage, or generate and
 * persist a fresh P-256 key pair.
 *
 * The key pair must survive service-worker restarts so every token request
 * uses the same public key — the authorization server ties issued tokens to
 * that specific key.
 */
export async function loadOrCreateDpopKeyPair(): Promise<CryptoKeyPair> {
  const result = await browser.storage.local.get(DPOP_KEY_STORAGE);
  const stored = (result as { dpopKey?: StoredDpopKey }).dpopKey;

  if (stored !== undefined) {
    try {
      const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
      const privateKey = await crypto.subtle.importKey('jwk', stored.privateKey, algorithm, false, ['sign']);
      const publicKey = await crypto.subtle.importKey('jwk', stored.publicKey, algorithm, true, ['verify']);
      return { privateKey, publicKey };
    } catch {
      // Stored key is corrupt; fall through to regenerate.
    }
  }

  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  await browser.storage.local.set({ [DPOP_KEY_STORAGE]: { privateKey: privateJwk, publicKey: publicJwk } });

  return keyPair;
}

/**
 * Create a DPoP proof JWT for a single HTTP request (RFC 9449 §4.2).
 *
 * @param keyPair - The persistent DPoP key pair from `loadOrCreateDpopKeyPair`
 * @param htm - HTTP method in upper-case (e.g. `"POST"`)
 * @param htu - Full target URL; query and fragment are stripped per §4.2
 * @param accessToken - When provided, the SHA-256 of the token is bound via the `ath` claim
 */
export async function createDpopProof(
  keyPair: CryptoKeyPair,
  htm: string,
  htu: string,
  accessToken?: string,
): Promise<string> {
  const rawPublicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  // Keep only the key-material fields; strip key_ops, ext, etc.
  const {
    d: _d,
    key_ops: _ko,
    ext: _ext,
    ...pubJwk
  } = rawPublicJwk as JsonWebKey & {
    d?: string;
    key_ops?: string[];
    ext?: boolean;
  };
  void _d;
  void _ko;
  void _ext;

  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: pubJwk };

  const payload: Record<string, unknown> = {
    jti: base64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
    htm,
    htu: normalizeHtu(htu),
    iat: Math.floor(Date.now() / 1000),
  };

  if (accessToken !== undefined) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
    payload['ath'] = base64urlEncode(new Uint8Array(hashBuffer));
  }

  const encodeJson = (obj: unknown): string => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64urlEncode(new Uint8Array(signatureBuffer))}`;
}

function normalizeHtu(url: string): string {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
}
