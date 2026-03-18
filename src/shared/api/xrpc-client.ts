import { Client, XrpcError, XrpcResponseError } from '@atproto/lex';

export interface XrpcClientConfig {
  service: string;
  did?: string;
  accessJwt?: string;
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

export interface PutRecordParams {
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown> & { $type: string };
  /** CID of the record this update is based on; enables optimistic concurrency */
  swapRecord?: string;
}

export interface PutRecordResult {
  uri: string;
  cid: string;
}

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
    const agentConfig: { service: string; did?: `did:${string}:${string}`; headers?: HeadersInit } = {
      service: config.service,
    };
    if (config.did !== undefined) {
      agentConfig.did = config.did as `did:${string}:${string}`;
    }
    if (config.accessJwt !== undefined) {
      agentConfig.headers = { Authorization: `Bearer ${config.accessJwt}` };
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
      const response = await this._client.getRecord(
        collection as `${string}.${string}.${string}`,
        rkey,
        { repo } as GetOpts,
      );
      const { value, cid } = response.body as { value: Record<string, unknown>; cid: string };

      return { value, cid };
    } catch (err) {
      throw mapXrpcError(err, `getRecord(${repo}/${collection}/${rkey})`);
    }
  }

  /**
   * Write a record to the PDS, optionally with optimistic concurrency via
   * `swapRecord` (CID of the record being replaced).
   *
   * @param params - `{ repo, collection, rkey, record, swapRecord? }`
   * @returns `{ uri, cid }` of the created/updated record
   * @throws `XrpcClientError` on any XRPC or network failure, including conflicts
   */
  public async putRecord(params: PutRecordParams): Promise<PutRecordResult> {
    const { repo, collection, rkey, record, swapRecord } = params;

    const options: Record<string, unknown> = { repo };
    if (swapRecord !== undefined) {
      options['swapRecord'] = swapRecord;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this._client.putRecord(record as any, rkey, options as Parameters<Client['putRecord']>[2]);
      const { uri, cid } = response.body as { uri: string; cid: string };

      return { uri, cid };
    } catch (err) {
      throw mapXrpcError(err, `putRecord(${repo}/${collection}/${rkey})`);
    }
  }
}
