import { Client, XrpcError, XrpcResponseError, l } from '@atproto/lex';

import { createDpopProof } from '../auth/dpop';

export interface XrpcClientConfig {
  service: string;
  did?: string;
  accessJwt?: string;
  /** Returns the DPoP key pair for proof-of-possession token binding (RFC 9449). */
  dpopKeyPairLoader?: () => Promise<CryptoKeyPair>;
  /**
   * Whether to attach DPoP proofs to XRPC requests.
   * When false, plain Bearer tokens are used instead.
   * Defaults to true when absent (production behaviour).
   */
  dpopEnabled?: boolean;
}

export interface GetRecordParams {
  repo: string;
  collection: string;
  rkey: string;
}

export interface GetRecordResult {
  value: Record<string, unknown>;
  cid: string;
}

export interface CreateRecordParams {
  repo: string;
  collection: string;
  record: Record<string, unknown> & { $type: string };
  rkey?: string;
  validate?: boolean;
}

export interface CreateRecordResult {
  uri: string;
  cid: string;
}

export interface PutRecordParams {
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown> & { $type: string };
  /** CID of the record this update is based on; enables optimistic concurrency */
  swapRecord?: string;
  /**
   * Ask the PDS to validate the record against its Lexicon schema before writing.
   * Defaults to `true`. Set to `false` only for records whose schema is not
   * registered on the PDS (e.g. third-party Lexicons).
   */
  validate?: boolean;
}

export interface PutRecordResult {
  uri: string;
  cid: string;
}

export type PutRecordWithSwapErrorKind = 'auth' | 'conflict' | 'network' | 'validation';

export interface PutRecordWithSwapError {
  kind: PutRecordWithSwapErrorKind;
  message: string;
  status?: number;
}

export interface PutRecordConflictDetails {
  currentCid: string;
  currentValue: Record<string, unknown>;
}

export interface PutRecordWithSwapParams extends PutRecordParams {
  swapRecord: NonNullable<PutRecordParams['swapRecord']>;
}

export interface ListRecordsParams {
  repo: string;
  collection: string;
  limit?: number;
  cursor?: string;
  reverse?: boolean;
}

export interface ListRecordsRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

export interface ListRecordsResult {
  records: ListRecordsRecord[];
  cursor?: string;
}

export interface PutRecordMergeAdvisory {
  hasConflicts: boolean;
  clientChanges: string[];
  serverChanges: string[];
  sharedChanges: string[];
  conflictingFields: string[];
}

export type PutRecordWithSwapResult =
  | {
      success: true;
      uri: string;
      cid: string;
    }
  | {
      success: false;
      error: PutRecordWithSwapError;
      conflict?: PutRecordConflictDetails;
    };

export interface XrpcClientErrorOptions {
  status?: number;
  cause?: unknown;
}

export class XrpcClientError extends Error {
  public readonly status: number | undefined;
  public override readonly cause?: unknown;

  public constructor(message: string, options?: XrpcClientErrorOptions) {
    super(message);
    this.name = 'XrpcClientError';
    this.status = options !== undefined ? options.status : undefined;
    this.cause = options?.cause;
  }
}

const mapXrpcError = (err: unknown, context: string): XrpcClientError => {
  if (err instanceof XrpcResponseError) {
    return new XrpcClientError(`${context}: ${err.message}`, {
      status: err.status,
      cause: err,
    });
  }

  if (err instanceof XrpcError) {
    return new XrpcClientError(`${context}: ${err.message}`, { cause: err });
  }

  if (err instanceof Error) {
    return new XrpcClientError(`${context}: ${err.message}`, { cause: err });
  }

  return new XrpcClientError(`${context}: unknown error`, { cause: err });
};

const mapStructuredPutRecordError = (error: XrpcClientError): PutRecordWithSwapError => {
  const withOptionalStatus = (kind: PutRecordWithSwapErrorKind): PutRecordWithSwapError => {
    if (error.status === undefined) {
      return { kind, message: error.message };
    }

    return { kind, message: error.message, status: error.status };
  };

  if (error.status === 409) {
    return withOptionalStatus('conflict');
  }

  // Devnet PDS (0.4.x) returns HTTP 400 InvalidSwap instead of 409 for stale swapRecord.
  // The error code "InvalidSwap" lives in XrpcResponseError.error (the cause), not in message.
  if (error.status === 400 && error.cause instanceof XrpcResponseError) {
    const errorCode = error.cause.error?.toLowerCase() ?? '';
    if (errorCode.includes('invalidswap')) {
      return withOptionalStatus('conflict');
    }
  }

  if (error.status === 400) {
    return withOptionalStatus('validation');
  }

  if (error.status === 401 || error.status === 403) {
    return withOptionalStatus('auth');
  }

  return withOptionalStatus('network');
};

const MAX_DEPTH = 20;

const valuesEqual = (left: unknown, right: unknown, depth = 0): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (depth >= MAX_DEPTH) {
    return false;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => valuesEqual(value, right[index], depth + 1));
  }

  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();

    if (!valuesEqual(leftKeys, rightKeys, depth + 1)) {
      return false;
    }

    return leftKeys.every(key => valuesEqual(leftRecord[key], rightRecord[key], depth + 1));
  }

  return false;
};

export function buildThreeWayMergeAdvisory(
  baseRecord: Record<string, unknown>,
  currentRecord: Record<string, unknown>,
  attemptedRecord: Record<string, unknown>,
): PutRecordMergeAdvisory {
  const keys = new Set([...Object.keys(baseRecord), ...Object.keys(currentRecord), ...Object.keys(attemptedRecord)]);

  const clientChanges: string[] = [];
  const serverChanges: string[] = [];
  const sharedChanges: string[] = [];
  const conflictingFields: string[] = [];

  for (const key of keys) {
    const baseValue = baseRecord[key];
    const currentValue = currentRecord[key];
    const attemptedValue = attemptedRecord[key];

    const clientChanged = !valuesEqual(attemptedValue, baseValue);
    const serverChanged = !valuesEqual(currentValue, baseValue);
    const bothNowMatch = valuesEqual(attemptedValue, currentValue);

    if (clientChanged && serverChanged) {
      if (bothNowMatch) {
        sharedChanges.push(key);
      } else {
        conflictingFields.push(key);
      }
      continue;
    }

    if (clientChanged) {
      clientChanges.push(key);
      continue;
    }

    if (serverChanged) {
      serverChanges.push(key);
    }
  }

  return {
    hasConflicts: conflictingFields.length > 0,
    clientChanges,
    serverChanges,
    sharedChanges,
    conflictingFields,
  };
}

/**
 * Thin, testable wrapper around the `@atproto/lex` `Client` for the two XRPC
 * operations the extension needs: `getRecord` and `putRecord`.
 *
 * All errors are normalized to `XrpcClientError` with an optional HTTP `status`.
 * The message router / background service worker should call this wrapper rather
 * than the underlying `Client` directly, so the same error-mapping and retry
 * logic is applied consistently.
 */
export class XrpcClient {
  /** @internal exposed as `_client` for unit-test mock injection */
  public readonly _client: Client;

  public constructor(config: XrpcClientConfig) {
    if (!config.service) {
      throw new XrpcClientError('XrpcClient requires a service URL');
    }

    // AgentOptions = AgentConfig | string | URL; we use AgentConfig here.
    // did and headers are optional on AgentConfig; build without them then assign
    // to avoid exactOptionalPropertyTypes complaints from spread-with-conditionals.
    const agentConfig: {
      service: string;
      did?: `did:${string}:${string}`;
      headers?: HeadersInit;
      fetch?: typeof globalThis.fetch;
    } = {
      service: config.service,
    };
    if (config.did !== undefined) {
      if (!/^did:[a-z]+:.+$/u.test(config.did)) {
        throw new XrpcClientError('Invalid DID format');
      }
      agentConfig.did = config.did as `did:${string}:${string}`;
    }
    if (config.accessJwt !== undefined) {
      // DPoP-bound tokens require the "DPoP" Authorization scheme (RFC 9449 §7.1).
      // Plain bearer tokens (no dpopKeyPairLoader) use the standard "Bearer" scheme.
      const scheme = config.dpopKeyPairLoader !== undefined ? 'DPoP' : 'Bearer';
      agentConfig.headers = { Authorization: `${scheme} ${config.accessJwt}` };
    }
    if (config.dpopKeyPairLoader !== undefined) {
      const dpopKeyPairLoader = config.dpopKeyPairLoader;
      const accessJwt = config.accessJwt;
      // Per-instance nonce cache: the server may issue a DPoP-Nonce and expect it on
      // subsequent requests (RFC 9449 §8). Proactively include it once received.
      let dpopNonce: string | undefined;
      agentConfig.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        const method = (init?.method ?? 'GET').toUpperCase();
        const keyPair = await dpopKeyPairLoader();

        const makeHeaders = async (nonce?: string): Promise<Headers> => {
          const proof = await createDpopProof(keyPair, method, url, accessJwt, nonce);
          const h = new Headers(init?.headers);
          h.set('DPoP', proof);
          return h;
        };

        let response = await globalThis.fetch(input, { ...init, headers: await makeHeaders(dpopNonce) });

        // Retry once if the server demands a nonce we haven't seen yet.
        if (response.status === 401 || response.status === 400) {
          const serverNonce = response.headers.get('DPoP-Nonce');
          if (serverNonce !== null && serverNonce !== dpopNonce) {
            dpopNonce = serverNonce;
            response = await globalThis.fetch(input, { ...init, headers: await makeHeaders(dpopNonce) });
          }
        } else {
          // Proactively update the cached nonce if the server rotates it.
          const refreshedNonce = response.headers.get('DPoP-Nonce');
          if (refreshedNonce !== null) dpopNonce = refreshedNonce;
        }

        return response;
      };
    }
    this._client = new Client(agentConfig);
  }

  /**
   * Fetch a single AT Protocol record from the PDS.
   *
   * @param params - `{ repo, collection, rkey }`
   * @returns Resolved `{ value, cid }` of the record
   * @throws `XrpcClientError` on any XRPC or network failure
   */
  public async getRecord(params: GetRecordParams): Promise<GetRecordResult> {
    const { repo, collection, rkey } = params;

    try {
      // NsidString = `${string}.${string}.${string}` and AtIdentifierString = DidString | HandleString;
      // both are branded; we trust callers provide valid values and cast.
      type GetOpts = Parameters<Client['getRecord']>[2];
      const response = await this._client.getRecord(collection as `${string}.${string}.${string}`, rkey, {
        repo,
      } as GetOpts);
      const { value, cid } = response.body as { value: Record<string, unknown>; cid: string };

      return { value, cid };
    } catch (err) {
      throw mapXrpcError(err, 'getRecord');
    }
  }

  /**
   * Create a new record in the PDS.
   */
  public async createRecord(params: CreateRecordParams): Promise<CreateRecordResult> {
    const { repo, collection, rkey, record, validate = true } = params;

    const options: Record<string, unknown> = { repo, collection, validate };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this._client.createRecord(record as any, rkey, options as any);
      const { uri, cid } = response.body as { uri: string; cid: string };

      return { uri, cid };
    } catch (err) {
      throw mapXrpcError(err, 'createRecord');
    }
  }

  /**
   * Write a record to the PDS, optionally with optimistic concurrency via
   * `swapRecord` (CID of the record being replaced).
   *
   * @param params - `{ repo, collection, rkey, record, swapRecord?, validate? }`
   * @returns `{ uri, cid }` of the created/updated record
   * @throws `XrpcClientError` on any XRPC or network failure, including conflicts
   */
  public async putRecord(params: PutRecordParams): Promise<PutRecordResult> {
    const { repo, collection: _collection, rkey, record, swapRecord, validate = true } = params;

    const options: Record<string, unknown> = { repo, validate };
    if (swapRecord !== undefined) {
      options['swapRecord'] = swapRecord;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this._client.putRecord(record as any, rkey, options as Parameters<Client['putRecord']>[2]);
      const { uri, cid } = response.body as { uri: string; cid: string };

      return { uri, cid };
    } catch (err) {
      throw mapXrpcError(err, 'putRecord');
    }
  }

  /**
   * High-level optimistic-concurrency helper for edit flows.
   *
   * Returns structured success/error results instead of throwing so UI callers
   * can distinguish retryable conflicts from validation/auth/network failures.
   * On `409 InvalidSwap`, it attempts to fetch the latest server record and
   * includes it in the result so the caller can show a retry / compare flow.
   * Requires `swapRecord` to be provided so optimistic concurrency is always
   * enforced for this helper.
   */
  public async putRecordWithSwap(params: PutRecordWithSwapParams): Promise<PutRecordWithSwapResult> {
    try {
      const result = await this.putRecord(params);
      return { success: true, uri: result.uri, cid: result.cid };
    } catch (err) {
      const error = err instanceof XrpcClientError ? err : mapXrpcError(err, 'putRecordWithSwap');
      const structuredError = mapStructuredPutRecordError(error);

      if (structuredError.kind !== 'conflict') {
        return { success: false, error: structuredError };
      }

      try {
        const latest = await this.getRecord({
          repo: params.repo,
          collection: params.collection,
          rkey: params.rkey,
        });

        return {
          success: false,
          error: structuredError,
          conflict: {
            currentCid: latest.cid,
            currentValue: latest.value,
          },
        };
      } catch {
        return { success: false, error: structuredError };
      }
    }
  }

  /**
   * Upload a blob (image, video, etc.) to the PDS.
   *
   * @param params - `{ data: Blob|File }`
   * @returns `{ blobRef: { $link: string }, mimeType: string }`
   * @throws `XrpcClientError` on any XRPC or network failure
   */
  /**
   * List records in a collection from the PDS.
   *
   * @param params - `{ repo, collection, limit?, cursor?, reverse? }`
   * @returns `{ records, cursor? }`
   * @throws `XrpcClientError` on any XRPC or network failure
   */
  public async listRecords(params: ListRecordsParams): Promise<ListRecordsResult> {
    const { repo, collection, limit, cursor, reverse } = params;

    try {
      const options: Record<string, unknown> = { repo };
      if (limit !== undefined) options.limit = limit;
      if (cursor !== undefined) options.cursor = cursor;
      if (reverse !== undefined) options.reverse = reverse;

      const response = await this._client.listRecords(
        collection as `${string}.${string}.${string}`,
        options as Parameters<Client['listRecords']>[1],
      );
      const body = response.body as {
        records: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
        cursor?: string;
      };

      const result: ListRecordsResult = {
        records: body.records.map(r => ({ uri: r.uri, cid: r.cid, value: r.value })),
      };

      if (body.cursor !== undefined) {
        result.cursor = body.cursor;
      }

      return result;
    } catch (err) {
      throw mapXrpcError(err, 'listRecords');
    }
  }

  public async uploadBlob(params: { data: Blob | File }): Promise<{ blobRef: l.BlobRef; mimeType: string }> {
    const { data } = params;

    try {
      const response = await this._client.uploadBlob(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { blob } = response.body as any;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { blobRef: blob as unknown as l.BlobRef, mimeType: blob.mimeType };
    } catch (err) {
      throw mapXrpcError(err, 'uploadBlob');
    }
  }
}
