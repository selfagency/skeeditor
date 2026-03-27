import type { Env } from './types.ts';

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

  const document = {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/secp256k1-2019/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#atproto_label`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        // Replace with actual base58-encoded secp256k1 public key
        publicKeyMultibase: 'REPLACE_WITH_PUBLIC_KEY_MULTIBASE',
      },
    ],
    service: [
      {
        id: '#atproto_labeler',
        type: 'AtprotoLabeler',
        serviceEndpoint: `https://${env.LABELER_HANDLE}`,
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
