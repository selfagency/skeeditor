import { BroadcastHub } from './hub.js';
import { serveDidDocument } from './did-document.js';
import { encodeErrorFrame } from './label.js';
import type { Env } from './types.ts';

export { BroadcastHub };

// ── CORS headers ──────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function addCors(response: Response): Response {
  const h = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    h.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers: h });
}

// ── Hub stub — single global DO instance ─────────────────────────────────────

function getHub(env: Env): DurableObjectStub {
  const id = env.BROADCAST_HUB.idFromName('global');
  return env.BROADCAST_HUB.get(id);
}

// ── Worker fetch handler ──────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return handleOptions();

    // ── GET /.well-known/did.json ──────────────────────────────────────────
    if (url.pathname === '/.well-known/did.json') {
      return addCors(serveDidDocument(env));
    }

    // ── GET /xrpc/com.atproto.label.subscribeLabels ────────────────────────
    // Proxy to the BroadcastHub DO as a WebSocket upgrade.
    if (url.pathname === '/xrpc/com.atproto.label.subscribeLabels') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        // HTTP fallback: redirect using SSE would be non-standard; return error frame body
        const frame = encodeErrorFrame({
          op: -1,
          t: '#error',
          error: 'UpgradeRequired',
          message: 'This endpoint requires a WebSocket connection.',
        });
        return new Response(frame, {
          status: 426,
          headers: { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const hubUrl = new URL('/ws', 'http://do');
      const cursor = url.searchParams.get('cursor');
      if (cursor !== null) hubUrl.searchParams.set('cursor', cursor);

      const hub = getHub(env);
      return hub.fetch(new Request(hubUrl.toString(), request));
    }

    // ── GET /xrpc/com.atproto.label.queryLabels ────────────────────────────
    if (url.pathname === '/xrpc/com.atproto.label.queryLabels' && request.method === 'GET') {
      const hubUrl = new URL('/query', 'http://do');
      const limit = url.searchParams.get('limit');
      const cursor = url.searchParams.get('cursor');
      const uriQ = url.searchParams.get('uriPatterns');
      if (limit !== null) hubUrl.searchParams.set('limit', limit);
      if (cursor !== null) hubUrl.searchParams.set('cursor', cursor);
      if (uriQ !== null) hubUrl.searchParams.set('uri', uriQ);

      const hub = getHub(env);
      const resp = await hub.fetch(new Request(hubUrl.toString()));
      return addCors(resp);
    }

    // ── POST /xrpc/tools.skeeditor.emitLabel ──────────────────────────────
    // Called by the extension after a successful putRecord.
    if (url.pathname === '/xrpc/tools.skeeditor.emitLabel' && request.method === 'POST') {
      const hub = getHub(env);
      const hubUrl = new URL('/emit', 'http://do');
      // Forward Authorization header and body through to the DO
      const forwarded = new Request(hubUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('Authorization') ?? '',
          'Content-Type': 'application/json',
        },
        body: request.body,
      });
      const resp = await hub.fetch(forwarded);
      return addCors(resp);
    }

    // ── GET /health ────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return addCors(Response.json({ ok: true, did: env.LABELER_DID }));
    }

    return addCors(new Response('Not found', { status: 404 }));
  },
} satisfies ExportedHandler<Env>;
