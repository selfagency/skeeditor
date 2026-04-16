import { validateEmitAuth } from './auth.js';
import { buildLabel, encodeLabelFrame } from './label.js';
import type { Env, Label, LabelFrame, WsAttachment } from './types.ts';

// How many labels to buffer for cursor backfill (ring buffer)
const RING_SIZE = 1_000;

interface StoredLabel {
  seq: number;
  label: Label;
}

/**
 * BroadcastHub — Durable Object
 *
 * One singleton instance (named "global") manages:
 * - A monotonically increasing sequence counter (persisted in SQLite storage)
 * - A ring buffer of recent labels for cursor-based backfill
 * - All connected WebSocket subscribers (CF WebSocket Hibernation API)
 *
 * WebSocket Hibernation lets Cloudflare evict idle connections from memory
 * while preserving them — the DO restarts on the next message/wake event.
 */
export class BroadcastHub implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      return this.handleWebSocket(request, url);
    }

    if (url.pathname === '/emit' && request.method === 'POST') {
      return this.handleEmit(request);
    }

    if (url.pathname === '/query') {
      return this.handleQuery(url);
    }

    return new Response('Not found', { status: 404 });
  }

  // ── WebSocket handler ───────────────────────────────────────────────────────

  private handleWebSocket(request: Request, url: URL): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const cursorParam = url.searchParams.get('cursor');
    const cursor = cursorParam !== null ? parseInt(cursorParam, 10) : -1;

    const { 0: client, 1: server } = new WebSocketPair();
    const attachment: WsAttachment = {
      cursor: Number.isFinite(cursor) ? cursor : -1,
      connectedAt: new Date().toISOString(),
    };
    this.state.acceptWebSocket(server, ['sub']);
    server.serializeAttachment(attachment);

    // If cursor was provided, backfill missed labels before live traffic
    if (Number.isFinite(cursor) && cursor >= 0) {
      void this.backfill(server, cursor);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Clients don't send messages — ignore pings or anything else
    void message;
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close();
  }

  // ── Emit handler ────────────────────────────────────────────────────────────

  private async handleEmit(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>)['uri'] !== 'string' ||
      typeof (body as Record<string, unknown>)['cid'] !== 'string' ||
      typeof (body as Record<string, unknown>)['did'] !== 'string'
    ) {
      return Response.json({ error: 'Missing required fields: uri, cid, did' }, { status: 400 });
    }

    const payload = body as { uri: string; cid: string; did: string };

    const authResult = await validateEmitAuth(
      request.headers.get('Authorization'),
      payload,
      fetch,
      request.headers.get('DPoP'),
    );
    if (!authResult.valid) {
      return Response.json({ error: authResult.reason }, { status: 401 });
    }

    // Increment sequence counter atomically
    const seq = await this.nextSeq();

    const label = buildLabel(this.env, payload.uri, payload.cid, seq);

    // Persist to ring buffer (KV via state.storage for simplicity)
    await this.appendToRing(seq, label);

    // Broadcast to all connected subscribers
    const frame: LabelFrame = { op: 1, t: '#labels', seq, labels: [label] };
    const encoded = encodeLabelFrame(frame);
    const subs = this.state.getWebSockets('sub');
    for (const ws of subs) {
      try {
        ws.send(encoded);
        // Update cursor in attachment
        const att = ws.deserializeAttachment() as WsAttachment;
        ws.serializeAttachment({ ...att, cursor: seq });
      } catch {
        // Dead connection — CF will clean it up
      }
    }

    return Response.json({ ok: true, seq });
  }

  // ── Query handler (backfill for queryLabels) ────────────────────────────────

  private async handleQuery(url: URL): Promise<Response> {
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 250);
    const cursor = parseInt(url.searchParams.get('cursor') ?? '0', 10);
    const uriFilter = url.searchParams.get('uri');

    const stored = await this.state.storage.list<StoredLabel>({ prefix: 'label:', limit: RING_SIZE });
    const labels: Label[] = [];
    let lastSeq = 0;

    for (const [, entry] of stored) {
      if (entry.seq <= cursor) continue;
      if (uriFilter !== null && entry.label.uri !== uriFilter) continue;
      labels.push(entry.label);
      lastSeq = Math.max(lastSeq, entry.seq);
      if (labels.length >= limit) break;
    }

    return Response.json({ labels, cursor: lastSeq });
  }

  // ── Backfill ────────────────────────────────────────────────────────────────

  private async backfill(ws: WebSocket, fromCursor: number): Promise<void> {
    const stored = await this.state.storage.list<StoredLabel>({ prefix: 'label:', limit: RING_SIZE });

    for (const [, entry] of stored) {
      if (entry.seq <= fromCursor) continue;
      const frame: LabelFrame = { op: 1, t: '#labels', seq: entry.seq, labels: [entry.label] };
      try {
        ws.send(encodeLabelFrame(frame));
      } catch {
        return;
      }
    }
  }

  // ── Sequence counter ────────────────────────────────────────────────────────

  private async nextSeq(): Promise<number> {
    const current = (await this.state.storage.get<number>('seq')) ?? 0;
    const next = current + 1;
    await this.state.storage.put('seq', next);
    return next;
  }

  // ── Ring buffer ─────────────────────────────────────────────────────────────

  private async appendToRing(seq: number, label: Label): Promise<void> {
    const key = `label:${seq.toString().padStart(10, '0')}`;
    await this.state.storage.put<StoredLabel>(key, { seq, label });

    // Evict deterministic oldest entry once the ring exceeds capacity.
    // Sequence numbers are monotonic, so when writing `seq`, the only record
    // that can fall out of the fixed window is `seq - RING_SIZE`.
    if (seq > RING_SIZE) {
      const oldestSeq = seq - RING_SIZE;
      const oldestKey = `label:${oldestSeq.toString().padStart(10, '0')}`;
      await this.state.storage.delete(oldestKey);
    }
  }
}
