import { browser } from 'wxt/browser';
import {
  APP_NAME,
  BSKY_APP_ORIGIN,
  buildLabelerSubscribeWsUrl,
  LABELER_BACKOFF_STORAGE_KEY,
  LABELER_CURSOR_STORAGE_KEY,
} from '../shared/constants';
import type { LabelReceivedNotification } from '../shared/messages';
import { createLogger } from '../shared/logger';

// ── Labeler WebSocket subscription ────────────────────────────────────────────
//
// Connects to the labeler's `subscribeLabels` WebSocket and broadcasts a
// LABEL_RECEIVED message to every bsky.app content-script tab whenever an
// `edited` label frame arrives. Each content script then fetches the current
// post text from Slingshot/PDS and updates the DOM — no polling required.
//
// The connection is long-lived: we reconnect automatically with exponential
// backoff (capped at 60 s) on any close or error. Service workers are kept
// alive by the keepalive ports registered in registerMessageRouter(), so this
// connection has the same lifetime as the SW itself.

const LABELER_WS_MIN_BACKOFF_MS = 2_000;
const LABELER_WS_MAX_BACKOFF_MS = 60_000;

// ── Minimal CBOR decoder ──────────────────────────────────────────────────────
//
// The labeler broadcasts ATProto subscribeLabels frames as raw CBOR binary
// (two concatenated CBOR objects: header then body). We cannot JSON.parse
// those — we need a proper decoder.
//
// We only need to handle the subset of CBOR used in label frames:
// major types 0 (uint), 1 (negint), 2 (bytes), 3 (text), 4 (array), 5 (map).

function cborDecode(buf: Uint8Array, pos: number): { value: unknown; pos: number } {
  const byte = buf[pos++]!;
  const maj = (byte >> 5) & 0x7;
  const info = byte & 0x1f;

  let len: number;
  if (info <= 23) {
    len = info;
  } else if (info === 24) {
    len = buf[pos++]!;
  } else if (info === 25) {
    len = (buf[pos++]! << 8) | buf[pos++]!;
  } else if (info === 26) {
    len = ((buf[pos++]! << 24) | (buf[pos++]! << 16) | (buf[pos++]! << 8) | buf[pos++]!) >>> 0;
  } else {
    // indefinite length / 64-bit — not expected in label frames; skip gracefully
    return { value: null, pos };
  }

  switch (maj) {
    case 0: // unsigned int
      return { value: len, pos };
    case 1: // negative int
      return { value: -1 - len, pos };
    case 2: {
      // byte string
      const end = pos + len;
      return { value: buf.slice(pos, end), pos: end };
    }
    case 3: {
      // text string
      const end = pos + len;
      return { value: new TextDecoder().decode(buf.slice(pos, end)), pos: end };
    }
    case 4: {
      // array
      const arr: unknown[] = [];
      for (let i = 0; i < len; i++) {
        const item = cborDecode(buf, pos);
        arr.push(item.value);
        pos = item.pos;
      }
      return { value: arr, pos };
    }
    case 5: {
      // map — use Map to prevent prototype-pollution via attacker-controlled keys
      const obj = new Map<string, unknown>();
      for (let i = 0; i < len; i++) {
        const k = cborDecode(buf, pos);
        pos = k.pos;
        const v = cborDecode(buf, pos);
        pos = v.pos;
        obj.set(String(k.value), v.value);
      }
      return { value: obj, pos };
    }
    default:
      return { value: null, pos };
  }
}

let labelerWs: WebSocket | null = null;
let labelerWsBackoff = LABELER_WS_MIN_BACKOFF_MS;
let labelerWsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let labelerWsConnecting = false;
let labelerCursor: number | null = null;
const log = createLogger('labeler-ws');

async function getStoredLabelerCursor(): Promise<number | null> {
  if (labelerCursor !== null) {
    return labelerCursor;
  }

  const result = await browser.storage.local.get(LABELER_CURSOR_STORAGE_KEY);
  const value = result[LABELER_CURSOR_STORAGE_KEY];
  labelerCursor = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  return labelerCursor;
}

async function setStoredLabelerCursor(nextCursor: number): Promise<void> {
  if (!Number.isFinite(nextCursor) || nextCursor < 0) {
    return;
  }

  if (labelerCursor !== null && nextCursor <= labelerCursor) {
    return;
  }

  labelerCursor = nextCursor;
  await browser.storage.local.set({ [LABELER_CURSOR_STORAGE_KEY]: nextCursor });
}

async function getStoredLabelerBackoff(): Promise<number> {
  const result = await browser.storage.local.get(LABELER_BACKOFF_STORAGE_KEY);
  const value = result[LABELER_BACKOFF_STORAGE_KEY];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(LABELER_WS_MIN_BACKOFF_MS, Math.min(value, LABELER_WS_MAX_BACKOFF_MS));
  }
  return LABELER_WS_MIN_BACKOFF_MS;
}

async function setStoredLabelerBackoff(backoffMs: number): Promise<void> {
  if (!Number.isFinite(backoffMs)) return;
  const clamped = Math.max(LABELER_WS_MIN_BACKOFF_MS, Math.min(backoffMs, LABELER_WS_MAX_BACKOFF_MS));
  await browser.storage.local.set({ [LABELER_BACKOFF_STORAGE_KEY]: clamped });
}

function broadcastLabelReceived(uri: string): void {
  const msg: LabelReceivedNotification = { type: 'LABEL_RECEIVED', uri };
  void browser.tabs
    .query({ url: `${BSKY_APP_ORIGIN}/*` })
    .then(tabs => {
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          void browser.tabs.sendMessage(tab.id, msg).catch(() => {
            // Content script may not be injected yet — ignore.
          });
        }
      }
    })
    .catch(() => undefined);
}

async function openLabelerWs(): Promise<void> {
  if (labelerWs !== null && labelerWs.readyState <= WebSocket.OPEN) return;
  if (labelerWsConnecting) return;

  labelerWsConnecting = true;

  try {
    labelerWsBackoff = await getStoredLabelerBackoff();
    const cursor = await getStoredLabelerCursor();
    const ws = new WebSocket(buildLabelerSubscribeWsUrl(cursor));
    // ATProto subscribeLabels frames are binary CBOR, not text JSON.
    ws.binaryType = 'arraybuffer';
    labelerWs = ws;

    ws.onopen = () => {
      log.debug('connected');
      labelerWsBackoff = LABELER_WS_MIN_BACKOFF_MS; // reset on successful connect
      void setStoredLabelerBackoff(labelerWsBackoff);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        if (!(event.data instanceof ArrayBuffer)) return;
        const buf = new Uint8Array(event.data);

        // Each frame = CBOR(header) || CBOR(body), concatenated.
        const header = cborDecode(buf, 0);
        const headerObj = header.value as Map<string, unknown>;
        // Only handle #labels frames
        if (headerObj.get('t') !== '#labels') return;

        const body = cborDecode(buf, header.pos);
        const bodyObj = body.value as Map<string, unknown>;
        const seq = bodyObj.get('seq');
        if (typeof seq === 'number') {
          void setStoredLabelerCursor(seq);
        }
        const labels = bodyObj.get('labels');
        if (!Array.isArray(labels)) return;

        for (const label of labels) {
          const l = label as Map<string, unknown>;
          const val = l.get('val');
          const uri = l.get('uri');
          if (val === 'edited' && typeof uri === 'string' && uri.length > 0) {
            log.debug('label-received', { uri });
            broadcastLabelReceived(uri);
          }
        }
      } catch {
        // Malformed frame — ignore.
      }
    };

    ws.onclose = () => {
      log.debug('closed-reconnecting', { backoffMs: labelerWsBackoff });
      labelerWs = null;
      labelerWsRetryTimer = setTimeout(() => {
        labelerWsBackoff = Math.min(labelerWsBackoff * 2, LABELER_WS_MAX_BACKOFF_MS);
        void setStoredLabelerBackoff(labelerWsBackoff);
        void openLabelerWs();
      }, labelerWsBackoff);
    };

    ws.onerror = () => {
      // onclose fires after onerror — let it handle reconnect.
      ws.close();
    };
  } catch (err) {
    log.error('init-failed', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    labelerWsConnecting = false;
  }
}

function connectLabelerWs(): void {
  void openLabelerWs();
}

export { connectLabelerWs };

export function cleanupLabelerWs(): void {
  if (labelerWsRetryTimer !== null) clearTimeout(labelerWsRetryTimer);
  labelerWs?.close();
}
