import type { Env } from './types.ts';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function buildSecp256k1PublicKeyMultibase(privateKeyHex: string): string {
  const { createPrivateKey, createPublicKey } = require('node:crypto') as typeof import('node:crypto');

  const privBytes = Buffer.from(privateKeyHex, 'hex');
  const oidSecp256k1 = Buffer.from([0x2b, 0x81, 0x04, 0x00, 0x0a]);
  const inner = Buffer.concat([
    Buffer.from([0x02, 0x01, 0x01]),
    Buffer.from([0x04, privBytes.length]),
    privBytes,
    Buffer.from([0xa0, 0x07, 0x06, 0x05]),
    oidSecp256k1,
  ]);
  const sec1Der = Buffer.concat([Buffer.from([0x30, inner.length]), inner]);

  const privateKey = createPrivateKey({ key: sec1Der, format: 'der', type: 'sec1' });
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  const prefix = (y[y.length - 1]! & 1) === 0 ? 0x02 : 0x03;
  const compressed = Buffer.concat([Buffer.from([prefix]), x]);

  let value = 0n;
  for (const byte of compressed) {
    value = (value << 8n) + BigInt(byte);
  }

  let encoded = '';
  while (value > 0n) {
    const index = Number(value % 58n);
    encoded = BASE58_ALPHABET[index]! + encoded;
    value /= 58n;
  }

  for (const byte of compressed) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }

  return `z${encoded}`;
}

function resolvePublicKeyMultibase(env: Env): string | null {
  if (typeof env.LABELER_SIGNING_KEY === 'string' && env.LABELER_SIGNING_KEY.length > 0) {
    try {
      return buildSecp256k1PublicKeyMultibase(env.LABELER_SIGNING_KEY);
    } catch {
      return null;
    }
  }

  if (typeof env.LABELER_PUBLIC_KEY_MULTIBASE === 'string' && env.LABELER_PUBLIC_KEY_MULTIBASE.length > 0) {
    return env.LABELER_PUBLIC_KEY_MULTIBASE;
  }

  return null;
}

/**
 * Serves the labeler's DID document at /.well-known/did.json
 *
 * The public key must be registered in the DID document for the labeler
 * to be verified by AppViews and other ATProto services.
 *
 * The corresponding private key is stored as LABELER_SIGNING_KEY secret.
 *
 * To generate a key pair:
 *   wrangler secret put LABELER_SIGNING_KEY
 *   (paste the hex-encoded private key)
 *
 * The public key multibase value below must be replaced with the actual
 * public key derived from your LABELER_SIGNING_KEY before deploying.
 */
export function serveDidDocument(env: Env): Response {
  const did = env.LABELER_DID;
  const publicKeyMultibase = resolvePublicKeyMultibase(env);

  if (publicKeyMultibase === null) {
    return Response.json(
      { error: 'Labeler public key is not configured. Provide LABELER_SIGNING_KEY or LABELER_PUBLIC_KEY_MULTIBASE.' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  const document = {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/secp256k1-2019/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#atproto_label`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyMultibase,
      },
    ],
    service: [
      {
        id: '#atproto_labeler',
        type: 'AtprotoLabeler',
        serviceEndpoint: env.LABELER_SERVICE_URL,
      },
    ],
  };

  return Response.json(document, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
