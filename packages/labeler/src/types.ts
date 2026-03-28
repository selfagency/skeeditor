export interface Env {
  BROADCAST_HUB: DurableObjectNamespace;
  LABELS_KV: KVNamespace;
  /** DID of this labeler, e.g. "did:web:labeler.skeeditor.app" */
  LABELER_DID: string;
  /** Human-readable handle for the labeler */
  LABELER_HANDLE: string;
  /**
   * secp256k1 private key for signing labels (hex-encoded 32 bytes).
   * Set via: wrangler secret put LABELER_SIGNING_KEY
   */
  LABELER_SIGNING_KEY?: string;
}

/** ATProto label object (ver 1) */
export interface Label {
  ver: 1;
  src: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string;
  /** secp256k1 signature over the DAG-CBOR-encoded label (without the sig field) */
  sig?: Uint8Array;
}

/** subscribeLabels frame sent to WebSocket clients */
export interface LabelFrame {
  op: 1;
  t: '#labels';
  seq: number;
  labels: Label[];
}

/** Error frame */
export interface ErrorFrame {
  op: -1;
  t: '#error';
  error: string;
  message?: string;
}

/** Body of POST /emit */
export interface EmitPayload {
  /** AT URI of the record that was edited, e.g. at://did:plc:.../app.bsky.feed.post/rkey */
  uri: string;
  /** CID of the newly committed record */
  cid: string;
  /** DID of the user who edited the post — must match the repo in uri */
  did: string;
}

/** Attachment stored on each hibernating WebSocket */
export interface WsAttachment {
  cursor: number;
  connectedAt: string;
}
