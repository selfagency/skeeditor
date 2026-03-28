import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME } from '../shared/constants';
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

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, CachedPost>();
const inFlight = new Map<string, Promise<string | null>>();

let currentDid: string | null = null;
let currentHandle: string | null = null;

export function setIdentity(did: string | null, handle: string | null): void {
  currentDid = did;
  currentHandle = handle;
}

/**
 * Normalize an AT-URI so its repo segment is always the DID, not a handle.
 */
export function normalizeCacheKey(atUri: string, repo: string): string {
  if (currentDid !== null && (repo === currentHandle || repo === currentDid)) {
    return atUri.replace(`at://${repo}/`, `at://${currentDid}/`);
  }
  return atUri;
}

// ── Storage persistence ───────────────────────────────────────────────────────

let browserStorage: { get: (key: string) => Promise<Record<string, unknown>>; set: (items: Record<string, unknown>) => Promise<void> } | null = null;

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
    console.warn(`${APP_NAME}: could not load edit cache`, err);
  }
}

async function persistToStorage(): Promise<void> {
  if (!browserStorage) return;
  try {
    const now = Date.now();
    const data: Record<string, CachedPost> = {};
    for (const [key, entry] of cache) {
      if (now - entry.fetchedAt < CACHE_TTL_MS) {
        data[key] = entry;
      }
    }
    await browserStorage.set({ [STORAGE_KEY]: data });
  } catch (err) {
    console.warn(`${APP_NAME}: could not persist edit cache`, err);
  }
}

// ── Cache access ──────────────────────────────────────────────────────────────

export function getCached(cacheKey: string): CachedPost | null {
  const entry = cache.get(cacheKey);
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
  void persistToStorage();
}

export function getCacheSize(): number {
  return cache.size;
}

// ── Slingshot fetch ───────────────────────────────────────────────────────────

async function fetchFromSlingshot(repo: string, collection: string, rkey: string): Promise<string | null> {
  const resolvedRepo = (repo === currentHandle && currentDid !== null) ? currentDid : repo;

  const url = new URL('https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord');
  url.searchParams.set('repo', resolvedRepo);
  url.searchParams.set('collection', collection);
  url.searchParams.set('rkey', rkey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLINGSHOT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as { value?: { text?: unknown } };
    const text = data.value?.text;
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── PDS fetch (authenticated, via service worker) ─────────────────────────────

async function fetchFromPds(repo: string, collection: string, rkey: string): Promise<string | null> {
  try {
    const response = await sendMessage({
      type: 'GET_RECORD',
      repo,
      collection,
      rkey,
    });
    if ('error' in response) return null;
    const text = (response as { value?: { text?: unknown } }).value?.text;
    return typeof text === 'string' ? text : null;
  } catch {
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
  if (cached) return cached.text;

  // Already fetching — return existing promise result (dedup)
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const fetchPromise = doFetch(cacheKey, repo, collection, rkey);
  inFlight.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function doFetch(cacheKey: string, repo: string, collection: string, rkey: string): Promise<string | null> {
  // Primary: Slingshot (public, firehose-invalidated)
  let text = await fetchFromSlingshot(repo, collection, rkey);

  // If the text from Slingshot matches the original (pre-edit) text,
  // Slingshot hasn't processed the edit yet — treat as miss
  const cached = cache.get(cacheKey);
  if (text !== null && cached?.originalText !== undefined && text === cached.originalText) {
    text = null;
  }

  // Fallback: PDS for current user's own posts
  if (text === null) {
    const resolvedRepo = (repo === currentHandle && currentDid !== null) ? currentDid : repo;
    const isOwnPost = resolvedRepo === currentDid;
    if (isOwnPost && currentDid !== null) {
      text = await fetchFromPds(resolvedRepo, collection, rkey);
    }
  }

  if (text !== null) {
    const existingEntry = cache.get(cacheKey);
    setCached(cacheKey, text, existingEntry?.originalText);
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

  while (pending.length > 0) {
    const batch = pending.splice(0, MAX_CONCURRENT_FETCHES);
    const settled = await Promise.allSettled(
      batch.map(async (post) => {
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
        console.warn(`${APP_NAME}: batch resolve rejection:`, result.reason);
      }
    }
  }

  return results;
}
