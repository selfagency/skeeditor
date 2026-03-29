import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME } from '../shared/constants';
import { createLogger } from '../shared/logger';
import { sendMessage } from '../shared/messages';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CachedPost {
  text: string;
  /** Original text before the edit — shown in Bluesky's "Edited" moderation dialog */
  originalText?: string;
  fetchedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'editedPosts';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SLINGSHOT_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT_FETCHES = 5;
const log = createLogger('cache');

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, CachedPost>();
const inFlight = new Map<string, Promise<string | null>>();

let currentDid: string | null = null;
let currentHandle: string | null = null;

// Debounce timer for storage persistence — prevents a burst of setCached() calls
// (e.g. during resolveBatch) from each triggering a full cache serialization.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 150;

// ── Handle ↔ DID registry ─────────────────────────────────────────────────────
//
// Bluesky's DOM uses handle-based URLs (e.g. feedItem-by-handle.bsky.social)
// while label pushes arrive with DID-based AT-URIs. This registry maps between
// the two so cache lookups succeed regardless of which form was used to store.

const handleToDidMap = new Map<string, string>();
const didToHandleMap = new Map<string, string>();

/**
 * Register a handle ↔ DID pair so the cache can look up entries stored under
 * either form. Call this whenever the mapping becomes known (auth state,
 * DID resolution on label push, etc.).
 */
export function registerIdentity(handle: string, did: string): void {
  const h = handle.toLowerCase();
  const d = did.toLowerCase();
  handleToDidMap.set(h, d);
  didToHandleMap.set(d, h);
  log.debug('registry-add', { handle: h, did: d });
}

function lookupDid(identifier: string): string | null {
  const lower = identifier.toLowerCase();
  if (lower.startsWith('did:')) return lower;
  return handleToDidMap.get(lower) ?? null;
}

function lookupHandle(identifier: string): string | null {
  const lower = identifier.toLowerCase();
  if (!lower.startsWith('did:')) return lower;
  return didToHandleMap.get(lower) ?? null;
}

/**
 * Return the alternate cache key form (handle↔DID swap), or null if the
 * mapping is unknown.
 */
function getAlternateCacheKey(cacheKey: string): string | null {
  const match = /^at:\/\/([^/]+)\/(.+)$/.exec(cacheKey);
  if (!match) return null;
  const repo = match[1]!;
  const rest = match[2]!;

  if (repo.startsWith('did:')) {
    const handle = lookupHandle(repo);
    if (handle) return `at://${handle}/${rest}`;
  } else {
    const did = lookupDid(repo);
    if (did) return `at://${did}/${rest}`;
  }
  return null;
}

export function setIdentity(did: string | null, handle: string | null): void {
  currentDid = did;
  currentHandle = handle;
  // Register the current user's handle ↔ DID pair.
  if (did !== null && handle !== null) {
    registerIdentity(handle, did);
  }
}

/**
 * Normalize an AT-URI so its repo segment is always the DID, not a handle.
 * Uses the handle↔DID registry to resolve any known user, not just the
 * currently authenticated one.
 */
export function normalizeCacheKey(atUri: string, repo: string): string {
  // Already DID-form — return as-is.
  if (repo.startsWith('did:')) return atUri;

  // Current user shortcut (most common case).
  if (currentDid !== null && (repo === currentHandle || repo === currentDid)) {
    return atUri.replace(`at://${repo}/`, `at://${currentDid}/`);
  }

  // Check the global registry for any known handle → DID mapping.
  const did = lookupDid(repo);
  if (did) {
    return atUri.replace(`at://${repo}/`, `at://${did}/`);
  }

  return atUri;
}

// ── Storage persistence ───────────────────────────────────────────────────────

let browserStorage: {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
} | null = null;

export function setStorage(storage: typeof browserStorage): void {
  browserStorage = storage;
}

export async function loadFromStorage(): Promise<void> {
  if (!browserStorage) return;
  try {
    const stored = await browserStorage.get(STORAGE_KEY);
    const raw = (stored[STORAGE_KEY] ?? {}) as Record<string, CachedPost>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(raw)) {
      if (now - entry.fetchedAt < CACHE_TTL_MS) {
        cache.set(key, entry);
      }
    }
  } catch (err) {
    console.warn(APP_NAME + ': could not load edit cache', err);
  }
}

async function persistToStorage(): Promise<void> {
  if (!browserStorage) return;
  try {
    const now = Date.now();
    const data = Object.fromEntries([...cache].filter(([, entry]) => now - entry.fetchedAt < CACHE_TTL_MS));
    await browserStorage.set({ [STORAGE_KEY]: data });
  } catch (err) {
    console.warn(APP_NAME + ': could not persist edit cache', err);
  }
}

// ── Cache access ──────────────────────────────────────────────────────────────

export function getCached(cacheKey: string): CachedPost | null {
  let entry = cache.get(cacheKey);

  // Try alternate key form (handle ↔ DID swap) if primary key missed.
  if (!entry) {
    const altKey = getAlternateCacheKey(cacheKey);
    if (altKey) {
      entry = cache.get(altKey);
    }
  }

  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= CACHE_TTL_MS) {
    cache.delete(cacheKey);
    return null;
  }
  return entry;
}

export function setCached(cacheKey: string, text: string, originalText?: string): void {
  const entry: CachedPost = {
    text,
    ...(originalText !== undefined && { originalText }),
    fetchedAt: Date.now(),
  };
  cache.set(cacheKey, entry);

  // Also store under alternate key form so lookups succeed regardless of
  // whether the caller used the handle-form or DID-form URI.
  const altKey = getAlternateCacheKey(cacheKey);
  if (altKey) {
    cache.set(altKey, entry);
  }

  schedulePersist();
}

function schedulePersist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistToStorage();
  }, PERSIST_DEBOUNCE_MS);
}

export function getCacheSize(): number {
  return cache.size;
}

// ── Slingshot fetch ───────────────────────────────────────────────────────────

async function fetchFromSlingshot(repo: string, collection: string, rkey: string): Promise<string | null> {
  const resolvedRepo = repo === currentHandle && currentDid !== null ? currentDid : repo;

  const url = new URL('https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord');
  url.searchParams.set('repo', resolvedRepo);
  url.searchParams.set('collection', collection);
  url.searchParams.set('rkey', rkey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLINGSHOT_TIMEOUT_MS);

  try {
    log.debug('slingshot-start', { repo: resolvedRepo, collection, rkey });
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      log.debug('slingshot-non-ok', { repo: resolvedRepo, collection, rkey, status: response.status });
      return null;
    }

    const data = (await response.json()) as { value?: { text?: unknown } };
    const text = data.value?.text;
    const resolvedText = typeof text === 'string' ? text : null;
    log.debug('slingshot-done', { repo: resolvedRepo, collection, rkey, textLength: resolvedText?.length ?? 0 });
    return resolvedText;
  } catch {
    log.debug('slingshot-error', { repo: resolvedRepo, collection, rkey });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── PDS fetch (authenticated, via service worker) ─────────────────────────────

async function fetchFromPds(repo: string, collection: string, rkey: string): Promise<string | null> {
  try {
    log.debug('pds-start', { repo, collection, rkey });
    const response = await sendMessage({
      type: 'GET_RECORD',
      repo,
      collection,
      rkey,
    });
    if ('error' in response) {
      log.debug('pds-error-response', { repo, collection, rkey, error: response.error });
      return null;
    }
    const text = (response as { value?: { text?: unknown } }).value?.text;
    const resolvedText = typeof text === 'string' ? text : null;
    log.debug('pds-done', { repo, collection, rkey, textLength: resolvedText?.length ?? 0 });
    return resolvedText;
  } catch {
    log.debug('pds-throw', { repo, collection, rkey });
    return null;
  }
}

// ── Core resolve ──────────────────────────────────────────────────────────────

/**
 * Resolve the latest text for a post. Checks cache first, then fetches from
 * Slingshot (primary) with PDS fallback for the user's own posts.
 *
 * Returns the text or null if unavailable. Never throws.
 */
export async function resolve(atUri: string, repo: string, collection: string, rkey: string): Promise<string | null> {
  const cacheKey = normalizeCacheKey(atUri, repo);

  // Cache hit — return immediately
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug('resolve-cache-hit', { cacheKey, textLength: cached.text.length });
    return cached.text;
  }

  // Already fetching — return existing promise result (dedup)
  const existing = inFlight.get(cacheKey);
  if (existing) {
    log.debug('resolve-inflight-hit', { cacheKey });
    return existing;
  }

  log.debug('resolve-miss', { atUri, repo, collection, rkey, cacheKey });

  const fetchPromise = doFetch(cacheKey, repo, collection, rkey);
  inFlight.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function doFetch(cacheKey: string, repo: string, collection: string, rkey: string): Promise<string | null> {
  const resolvedRepo = repo === currentHandle && currentDid !== null ? currentDid : repo;
  const isOwnPost = resolvedRepo === currentDid && currentDid !== null;
  log.debug('doFetch-start', { cacheKey, repo, resolvedRepo, collection, rkey, isOwnPost });

  // For own posts, prefer authenticated PDS reads first. Slingshot can lag by
  // a few seconds and temporarily return the pre-edit text, which causes the UI
  // to regress to stale content.
  let text: string | null;
  if (isOwnPost) {
    text = await fetchFromPds(resolvedRepo, collection, rkey);
    if (text === null) {
      log.debug('doFetch-own-pds-miss-fallback-slingshot', { cacheKey, resolvedRepo, rkey });
      text = await fetchFromSlingshot(repo, collection, rkey);
    }
  } else {
    // Primary for non-own posts: Slingshot (public, firehose-invalidated)
    text = await fetchFromSlingshot(repo, collection, rkey);
  }

  // If the text from Slingshot matches the original (pre-edit) text,
  // Slingshot hasn't processed the edit yet — treat as miss
  const cached = cache.get(cacheKey);
  if (text !== null && cached?.originalText !== undefined && text === cached.originalText) {
    log.debug('doFetch-reject-original-text-match', { cacheKey, rkey });
    text = null;
  }

  // Fallback: PDS for current user's own posts
  if (text === null) {
    if (isOwnPost) {
      log.debug('doFetch-own-fallback-pds-retry', { cacheKey, resolvedRepo, rkey });
      text = await fetchFromPds(resolvedRepo, collection, rkey);
    }
  }

  if (text !== null) {
    const existingEntry = cache.get(cacheKey);
    setCached(cacheKey, text, existingEntry?.originalText);
    log.debug('doFetch-cache-store', { cacheKey, textLength: text.length });
  } else {
    log.debug('doFetch-null', { cacheKey, repo: resolvedRepo, rkey });
  }

  return text;
}

// ── Batch resolve (for multiple edited posts on a page) ───────────────────────

interface PostRef {
  atUri: string;
  repo: string;
  rkey: string;
}

/**
 * Resolve multiple posts concurrently with bounded concurrency.
 * Returns a map of cacheKey → text for posts that resolved successfully.
 */
export async function resolveBatch(posts: PostRef[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const pending = [...posts];
  log.debug('resolveBatch-start', { count: posts.length, maxConcurrent: MAX_CONCURRENT_FETCHES });

  while (pending.length > 0) {
    const batch = pending.splice(0, MAX_CONCURRENT_FETCHES);
    const settled = await Promise.allSettled(
      batch.map(async post => {
        const text = await resolve(post.atUri, post.repo, APP_BSKY_FEED_POST_COLLECTION, post.rkey);
        if (text !== null) {
          const cacheKey = normalizeCacheKey(post.atUri, post.repo);
          results.set(cacheKey, text);
        }
      }),
    );
    // Log any unexpected rejections (shouldn't happen since resolve never throws)
    for (const result of settled) {
      if (result.status === 'rejected') {
        console.warn(APP_NAME + ': batch resolve rejection:', result.reason);
      }
    }
  }

  log.debug('resolveBatch-done', { resolvedCount: results.size });

  return results;
}
