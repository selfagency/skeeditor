import { createSign, createPrivateKey } from 'node:crypto';
import type { Env, Label, LabelFrame, ErrorFrame } from './types.ts';

// ── Minimal CBOR encoder ──────────────────────────────────────────────────────
//
// ATProto subscribeLabels frames are encoded as DAG-CBOR:
// each WebSocket message = CBOR(header) + CBOR(body)
// Header: { op: 1, t: "#labels" } or { op: -1, t: "#error" }
// Body:   the labels/error payload
//
// We only need to encode small objects/arrays of strings and ints, so a
// recursive minimal encoder is sufficient.

function cborEncodeUint(n: number): Uint8Array {
  if (n <= 0x17) return new Uint8Array([0x00 | n]);
  if (n <= 0xff) return new Uint8Array([0x18, n]);
  if (n <= 0xffff) return new Uint8Array([0x19, (n >> 8) & 0xff, n & 0xff]);
  return new Uint8Array([0x1a, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

function cborEncodeNegInt(n: number): Uint8Array {
  // n is already negative; CBOR encodes as major type 1 (-1 - n_encoded)
  const encoded = -1 - n;
  if (encoded <= 0x17) return new Uint8Array([0x20 | encoded]);
  if (encoded <= 0xff) return new Uint8Array([0x38, encoded]);
  return new Uint8Array([0x39, (encoded >> 8) & 0xff, encoded & 0xff]);
}

function cborEncodeString(s: string): Uint8Array {
  const te = new TextEncoder();
  const bytes = te.encode(s);
  const len = bytes.length;
  let prefix: Uint8Array;
  if (len <= 0x17) {
    prefix = new Uint8Array([0x60 | len]);
  } else if (len <= 0xff) {
    prefix = new Uint8Array([0x78, len]);
  } else {
    prefix = new Uint8Array([0x79, (len >> 8) & 0xff, len & 0xff]);
  }
  const result = new Uint8Array(prefix.length + bytes.length);
  result.set(prefix, 0);
  result.set(bytes, prefix.length);
  return result;
}

function cborEncode(value: unknown): Uint8Array {
  if (value === null || value === undefined) {
    return new Uint8Array([0xf6]); // null
  }
  if (typeof value === 'boolean') {
    return new Uint8Array([value ? 0xf5 : 0xf4]);
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value >= 0 ? cborEncodeUint(value) : cborEncodeNegInt(value);
    }
    // float64
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint8(0, 0xfb);
    view.setFloat64(1, value, false);
    return new Uint8Array(buf);
  }
  if (typeof value === 'string') {
    return cborEncodeString(value);
  }
  if (Array.isArray(value)) {
    const len = value.length;
    let prefix: Uint8Array;
    if (len <= 0x17) {
      prefix = new Uint8Array([0x80 | len]);
    } else if (len <= 0xff) {
      prefix = new Uint8Array([0x98, len]);
    } else {
      prefix = new Uint8Array([0x99, (len >> 8) & 0xff, len & 0xff]);
    }
    const parts: Uint8Array[] = [prefix];
    for (const item of value) {
      parts.push(cborEncode(item));
    }
    return concatBytes(parts);
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const len = entries.length;
    let prefix: Uint8Array;
    if (len <= 0x17) {
      prefix = new Uint8Array([0xa0 | len]);
    } else if (len <= 0xff) {
      prefix = new Uint8Array([0xb8, len]);
    } else {
      prefix = new Uint8Array([0xb9, (len >> 8) & 0xff, len & 0xff]);
    }
    const parts: Uint8Array[] = [prefix];
    for (const [k, v] of entries) {
      parts.push(cborEncodeString(k));
      parts.push(cborEncode(v));
    }
    return concatBytes(parts);
  }
  return new Uint8Array([0xf6]);
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Sign an ATProto label with the labeler's secp256k1 private key.
 *
 * The signature is computed over the DAG-CBOR encoding of the label
 * object with the `sig` field absent, as per the ATProto label spec.
 * The `sig` field contains a compact 64-byte (r || s) secp256k1 signature.
 *
 * @see https://atproto.com/specs/label#signed-label-objects
 */
function signLabel(label: Label, privateKeyHex: string): Label {
  // Encode label without sig field
  const { sig: _, ...unsigned } = label;
  const encoded = cborEncode(unsigned);

  // Build SEC1 DER for secp256k1 private key:
  // SEQUENCE { INTEGER 1, OCTET STRING <priv>, [0] { OID secp256k1 } }
  const privBytes = Buffer.from(privateKeyHex, 'hex'); // 32 bytes
  const oidSecp256k1 = Buffer.from([0x2b, 0x81, 0x04, 0x00, 0x0a]); // 1.3.132.0.10
  const inner = Buffer.concat([
    Buffer.from([0x02, 0x01, 0x01]), // INTEGER 1 (version)
    Buffer.from([0x04, privBytes.length]),
    privBytes, // OCTET STRING
    Buffer.from([0xa0, 0x07, 0x06, 0x05]),
    oidSecp256k1, // [0] { OID secp256k1 }
  ]);
  const sec1Der = Buffer.concat([Buffer.from([0x30, inner.length]), inner]);

  const privateKey = createPrivateKey({ key: sec1Der, format: 'der', type: 'sec1' });

  // ieee-p1363 encoding gives compact 64-byte r||s signature (not DER)
  const sig = createSign('SHA256').update(encoded).sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  return { ...unsigned, sig: new Uint8Array(sig) };
}

// ── Label construction ────────────────────────────────────────────────────────

/**
 * Build a signed ATProto label object marking a post as edited.
 */
export function buildLabel(env: Env, uri: string, cid: string, _seq: number): Label {
  const unsigned: Label = {
    ver: 1,
    src: env.LABELER_DID,
    uri,
    cid,
    val: 'edited',
    cts: new Date().toISOString(),
  };

  if (env.LABELER_SIGNING_KEY) {
    try {
      return signLabel(unsigned, env.LABELER_SIGNING_KEY);
    } catch (e) {
      console.error('Failed to sign label:', e);
    }
  }

  return unsigned;
}

// ── Frame encoding ────────────────────────────────────────────────────────────

/**
 * Encode a #labels frame as CBOR(header) + CBOR(body) per the
 * com.atproto.label.subscribeLabels wire format.
 */
export function encodeLabelFrame(frame: LabelFrame): Uint8Array {
  const header = { op: frame.op, t: frame.t };
  const body = { seq: frame.seq, labels: frame.labels };
  return concatBytes([cborEncode(header), cborEncode(body)]);
}

/**
 * Encode an #error frame.
 */
export function encodeErrorFrame(frame: ErrorFrame): Uint8Array {
  const header = { op: frame.op, t: frame.t };
  const body: Record<string, unknown> = { error: frame.error };
  if (frame.message !== undefined) body['message'] = frame.message;
  return concatBytes([cborEncode(header), cborEncode(body)]);
}
