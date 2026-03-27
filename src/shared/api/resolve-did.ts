/**
 * Resolve a DID to get the PDS URL from the DID document.
 *
 * For did:plc, resolves via https://plc.directory/did/{did}
 * For did:web, resolves via https://{domain}/.well-known/did.json
 */

export interface DidDocument {
  '@context'?: string | string[];
  id: string;
  alsoKnownAs?: string[];
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
  }>;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export class DidResolutionError extends Error {
  public readonly did: string;

  public constructor(message: string, did: string) {
    super(message);
    this.name = 'DidResolutionError';
    this.did = did;
  }
}

/**
 * Get the PDS URL from a DID document.
 * Looks for a service with type "AtprotoPersonalDataServer" or "atproto-pds".
 */
export function getPdsUrlFromDidDocument(doc: DidDocument): string | null {
  if (!doc.service || doc.service.length === 0) {
    return null;
  }

  // Look for AtprotoPersonalDataServer or atproto-pds service
  const pdsService = doc.service.find(s => s.type === 'AtprotoPersonalDataServer' || s.type === 'atproto-pds');

  return pdsService?.serviceEndpoint ?? null;
}

/**
 * Get the handle from a DID document.
 * Also known as "alsoKnownAs", contains handles like "did:plc:..." -> ["at://handle.bsky.social"]
 */
export function getHandleFromDidDocument(doc: DidDocument): string | null {
  if (!doc.alsoKnownAs || doc.alsoKnownAs.length === 0) {
    return null;
  }

  // Also known as can be handles in the form "at://handle.bsky.social" or direct handles
  for (const aka of doc.alsoKnownAs) {
    // If it's an at-uri, extract the handle
    if (aka.startsWith('at://')) {
      const handle = aka.slice(5); // Remove 'at://' prefix
      return handle;
    }
    // If it's a handle (domain format)
    if (aka.includes('.') && !aka.startsWith('did:')) {
      return aka;
    }
  }

  return null;
}

/**
 * Resolve a did:plc to its DID document.
 * URL format: https://plc.directory/did:plc:{identifier}
 */
async function resolveDidPlc(did: string): Promise<DidDocument> {
  // PLC directory URL format: https://plc.directory/did:plc:{identifier}
  const url = `https://plc.directory/${did}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new DidResolutionError(`Failed to resolve did:plc: ${response.status} ${response.statusText}`, did);
  }

  return response.json();
}

/**
 * Resolve a did:web to its DID document.
 */
async function resolveDidWeb(did: string): Promise<DidDocument> {
  const didWithoutPrefix = did.slice('did:web:'.length);
  const domain = decodeURIComponent(didWithoutPrefix);
  const url = `https://${domain}/.well-known/did.json`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new DidResolutionError(`Failed to resolve did:web: ${response.status} ${response.statusText}`, did);
  }

  return response.json();
}

/**
 * Resolve a DID to its DID document.
 *
 * Supports did:plc and did:web methods.
 */
export async function resolveDid(did: string): Promise<DidDocument> {
  if (did.startsWith('did:plc:')) {
    return resolveDidPlc(did);
  }

  if (did.startsWith('did:web:')) {
    return resolveDidWeb(did);
  }

  throw new DidResolutionError(`Unsupported DID method: ${did}`, did);
}

/**
 * Get the PDS URL for a given DID by resolving the DID document.
 */
export async function getPdsUrlForDid(did: string): Promise<string | null> {
  try {
    const doc = await resolveDid(did);
    return getPdsUrlFromDidDocument(doc);
  } catch {
    return null;
  }
}

/**
 * Get the handle for a given DID.
 * Tries multiple methods in order:
 * 1. DID document resolution
 * 2. Bluesky public API (app.bsky.actor.getProfile)
 */
export async function getHandleForDid(did: string): Promise<string | null> {
  // First, try DID document resolution
  try {
    const doc = await resolveDid(did);
    const handle = getHandleFromDidDocument(doc);
    if (handle) return handle;
  } catch {
    // DID document resolution failed, try fallback
  }

  // Fallback: Use Bluesky public API to get profile
  try {
    const handle = await getHandleFromBlskyApi(did);
    if (handle) return handle;
  } catch {
    // API fallback failed
  }

  return null;
}

/**
 * Get handle from Bluesky's public API.
 * Uses app.bsky.actor.getProfile endpoint.
 */
async function getHandleFromBlskyApi(did: string): Promise<string | null> {
  // Try both public API endpoints
  const endpoints = [
    `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    `https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const handle = data?.handle;
      if (typeof handle === 'string' && handle.length > 0) {
        return handle;
      }
    } catch {
      // Try next endpoint
    }
  }

  return null;
}

/**
 * Resolve both PDS URL and handle for a given DID.
 */
export async function resolveDidInfo(did: string): Promise<{ pdsUrl: string | null; handle: string | null }> {
  try {
    const doc = await resolveDid(did);
    return {
      pdsUrl: getPdsUrlFromDidDocument(doc),
      handle: getHandleFromDidDocument(doc),
    };
  } catch {
    return { pdsUrl: null, handle: null };
  }
}
