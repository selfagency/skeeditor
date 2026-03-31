import { browser, type Browser } from 'wxt/browser';
import { getHandleForDid } from '../shared/api/resolve-did';
import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME } from '../shared/constants';
import { createLogger } from '../shared/logger';
import type {
  AuthListAccountsAccount,
  LabelReceivedNotification,
  PutRecordConflictResponse,
  PutRecordResponse,
} from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { EditModal } from './edit-modal';
import { EditHistoryModal } from './edit-history-modal';
import {
  getCached,
  getCacheSize,
  loadFromStorage,
  normalizeCacheKey,
  registerIdentity,
  resolveBatch,
  resolve as resolveEditedText,
  setCached,
  setIdentity,
  setStorage,
} from './edited-post-cache';
import {
  extractPostInfo,
  extractPostText,
  findPosts,
  updatePostText,
  updatePostTimestamp,
  type PostInfo,
} from './post-detector';
import { buildUpdatedPostRecord, type EditablePostRecord, validateUpdatedPostRecord } from './post-editor';
import './styles.css';
import { ensureToastRegistered } from './toast';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';
const ARCHIVED_BUTTON_ATTRIBUTE = 'data-skeeditor-archived-intercepted';
const EDITED_BUTTON_ATTRIBUTE = 'data-skeeditor-edited-intercepted';
const ACTION_AREA_WAIT_TIMEOUT = 3000;

const log = createLogger('content');

// ── Toast notification ────────────────────────────────────────────────────────

function showToast(message: string): void {
  ensureToastRegistered();
  const host = document.createElement('skeeditor-toast');
  host.setAttribute('message', message);
  document.body.appendChild(host);
}

// ── Recent record cache (avoids stale GET_RECORD after a fresh save) ──────────

const RECORD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface RecentRecordEntry {
  record: EditablePostRecord;
  cid: string;
  savedAt: number;
}

const recentRecordsCache = new Map<string, RecentRecordEntry>();

function applyEditedPostsFromCache(posts?: PostInfo[]): void {
  if (getCacheSize() === 0) return;

  let scanned = 0;
  let cacheHits = 0;
  let applied = 0;

  // ── 1. Normal path: findPosts() covers feed items, replies, search results,
  //       list views, notifications — anything with a recognisable container.
  //   Accept a pre-computed posts array from scanForPosts to avoid a redundant
  //   DOM scan when called in the same synchronous frame.
  const allPosts = posts ?? [...findPosts(document)];
  for (const postInfo of allPosts) {
    scanned += 1;
    const cacheKey = normalizeCacheKey(postInfo.atUri, postInfo.repo);
    const entry = getCached(cacheKey);
    if (entry !== null) {
      cacheHits += 1;
      const currentText = extractPostText(postInfo.element).trim();
      if (currentText !== entry.text.trim()) {
        updatePostText(postInfo.element, entry.text);
        applied += 1;
      }
    }
  }

  // ── 2. Thread-root fallback for post permalink pages.
  const threadApplied = applyToThreadRoot();
  log.debug('apply-cache', { cacheSize: getCacheSize(), scanned, cacheHits, applied, threadApplied });
}

/**
 * Apply cached text to the thread-root post on permalink pages.
 * Single implementation used by all paths (MO, label push, permalink load).
 */
function applyToThreadRoot(text?: string, rkey?: string): boolean {
  const urlMatch = /\/profile\/([^/?#]+)\/post\/([^/?#]+)/.exec(window.location.pathname);
  if (!urlMatch) return false;

  const urlRepo = urlMatch[1];
  const urlRkey = rkey ?? urlMatch[2];
  if (!urlRepo || !urlRkey) return false;

  // If explicit text is given, apply directly.
  // Otherwise look up from cache. Only try the URL repo (which is the
  // post author's identity) — do NOT try currentDid/currentHandle here,
  // as that causes cross-contamination when the current user's cached post
  // gets applied to someone else's thread root.
  let resolvedText = text ?? null;

  if (resolvedText === null) {
    // The URL repo might be a handle or DID. Try both forms via normalizeCacheKey
    // which will normalize currentUser's handle→DID. For other users, try as-is.
    const candidateUri = `at://${urlRepo}/${APP_BSKY_FEED_POST_COLLECTION}/${urlRkey}`;
    const normalizedKey = normalizeCacheKey(candidateUri, urlRepo);
    const entry = getCached(normalizedKey);
    if (entry !== null) {
      resolvedText = entry.text;
    } else {
      // If URL repo is a handle, try DID-canonicalized keys discovered from
      // visible post metadata (e.g. feedItem-by-did:* containers).
      for (const p of findPosts(document)) {
        if (p.rkey !== urlRkey) continue;
        if (p.repo.startsWith('did:')) {
          const didKey = normalizeCacheKey(`at://${p.repo}/${APP_BSKY_FEED_POST_COLLECTION}/${urlRkey}`, p.repo);
          const didEntry = getCached(didKey);
          if (didEntry !== null) {
            resolvedText = didEntry.text;
            break;
          }
        }
      }
    }
  }

  if (resolvedText === null) return false;

  // On permalink pages, [data-testid="postDetailedText"] is the thread root's
  // text element. On bsky.app, this element is often rendered *outside* the
  // postThreadItem container, so querying it directly is more reliable than
  // going through extractPostText(containerElement) which falls back to the
  // entire container's textContent and produces garbage comparisons.
  const detailedTextEl = document.querySelector<HTMLElement>('[data-testid="postDetailedText"]');
  if (detailedTextEl) {
    const domText = detailedTextEl.textContent?.trim() ?? '';
    if (domText !== resolvedText.trim()) {
      detailedTextEl.textContent = resolvedText;
    }
    return true;
  }

  // Fallback: postDetailedText not found (feed/list views that use standard
  // postThreadItem layout). Use findPosts to match by rkey and update.
  for (const p of findPosts(document)) {
    if (p.rkey === urlRkey) {
      const domText = extractPostText(p.element).trim();
      if (domText !== resolvedText.trim()) {
        updatePostText(p.element, resolvedText);
      }
      return true;
    }
  }

  return false;
}

// ── Fetch triggers ────────────────────────────────────────────────────────────
//
// Three distinct events trigger fetches from Slingshot/PDS. The MutationObserver
// NEVER fetches — it only applies cached text to the DOM.

/**
 * Trigger 1: Permalink page load — fetch from Slingshot for the thread root,
 * but ONLY if the post is known to be edited ("Edited" badge in the DOM).
 * Without this gate we'd fetch and cache every permalink post, overwriting
 * the DOM with Slingshot's text even for unedited posts.
 */
async function fetchPermalinkPost(gen: number, posts?: PostInfo[]): Promise<void> {
  const urlMatch = /\/profile\/([^/?#]+)\/post\/([^/?#]+)/.exec(window.location.pathname);
  if (!urlMatch) {
    log.debug('fetch-permalink-skip', { reason: 'not-permalink', pathname: window.location.pathname });
    return;
  }

  const repo = urlMatch[1]!;
  const rkey = urlMatch[2]!;
  const atUri = `at://${repo}/${APP_BSKY_FEED_POST_COLLECTION}/${rkey}`;
  const atCacheKey = normalizeCacheKey(atUri, repo);

  // Scope the "Edited" badge check to the thread-root container for this permalink.
  // A broad document.querySelector would match an edited badge on a reply or embedded
  // quote, causing us to fetch the root post even when it isn't edited.
  //   Use the pre-computed posts snapshot when available to avoid a redundant DOM scan.
  let rootPost: ReturnType<typeof extractPostInfo> | null = null;
  const initialPosts = posts ?? [...findPosts(document)];
  for (const p of initialPosts) {
    if (normalizeCacheKey(p.atUri, p.repo) === atCacheKey) {
      rootPost = p;
      break;
    }
  }
  if (!rootPost) {
    // Root not in DOM yet — MutationObserver / scanForPosts will handle it on next render.
    log.debug('fetch-permalink-skip', { reason: 'root-post-not-found', atUri });
    return;
  }
  const editedBadge = rootPost.element.querySelector('button[aria-label="Edited"]');
  if (!editedBadge) {
    log.debug('fetch-permalink-skip', { reason: 'no-edited-badge', pathname: window.location.pathname });
    return;
  }

  log.debug('fetch-permalink-start', { atUri, repo, rkey });

  const text = await resolveEditedText(atUri, repo, APP_BSKY_FEED_POST_COLLECTION, rkey);

  // Discard result if a newer scan has already taken ownership of DOM updates.
  if (gen !== scanGeneration) {
    log.debug('fetch-permalink-stale', { gen, scanGeneration });
    return;
  }

  if (text !== null) {
    applyToThreadRoot(text, rkey);
    // Also try findPosts in case the DOM has rendered
    for (const p of findPosts(document)) {
      const cacheKey = normalizeCacheKey(p.atUri, p.repo);
      if (cacheKey === atCacheKey && extractPostText(p.element).trim() !== text.trim()) {
        updatePostText(p.element, text);
        break;
      }
    }
    log.debug('fetch-permalink-applied', { atUri, textLength: text.length });
  } else {
    log.debug('fetch-permalink-miss', { atUri });
  }
}

/**
 * Trigger 2: DOM scan for "Edited" badge — bsky.app renders
 * `button[aria-label="Edited"]` for posts labeled as edited.
 */
async function fetchEditedPostsInView(gen: number): Promise<void> {
  const editedButtons = document.querySelectorAll<HTMLElement>('button[aria-label="Edited"]');
  if (editedButtons.length === 0) {
    log.debug('fetch-edited-skip', { reason: 'no-edited-buttons' });
    return;
  }

  const postsToFetch: Array<{ atUri: string; repo: string; rkey: string }> = [];

  for (const btn of editedButtons) {
    // Walk up to the nearest post container
    const postElement =
      btn.closest<HTMLElement>('[data-at-uri]') ??
      btn.closest<HTMLElement>('[data-uri]') ??
      btn.closest<HTMLElement>('[data-testid^="postThreadItem"]') ??
      btn.closest<HTMLElement>('[data-testid^="feedItem"]') ??
      btn.closest<HTMLElement>('article');
    if (!postElement) continue;

    const info = extractPostInfo(postElement);
    if (!info) continue;

    const cacheKey = normalizeCacheKey(info.atUri, info.repo);
    if (getCached(cacheKey) !== null) continue;

    postsToFetch.push({ atUri: info.atUri, repo: info.repo, rkey: info.rkey });
  }

  if (postsToFetch.length === 0) {
    log.debug('fetch-edited-skip', { reason: 'no-uncached-posts', editedButtonCount: editedButtons.length });
    return;
  }

  log.debug('fetch-edited-start', {
    editedButtonCount: editedButtons.length,
    postsToFetch: postsToFetch.map(p => ({ atUri: p.atUri, repo: p.repo, rkey: p.rkey })),
  });

  const results = await resolveBatch(postsToFetch);
  log.debug('fetch-edited-resolved', { resultCount: results.size });

  // Discard stale results — a newer scan has already taken ownership.
  if (gen !== scanGeneration) {
    log.debug('fetch-edited-stale', { gen, scanGeneration });
    return;
  }

  // Build a one-pass index of current DOM posts to avoid O(results × posts) scans.
  const postIndex = new Map<string, PostInfo>();
  for (const p of findPosts(document)) {
    postIndex.set(normalizeCacheKey(p.atUri, p.repo), p);
  }

  // Apply resolved text to DOM
  let applied = 0;
  for (const [cacheKey, text] of results) {
    const p = postIndex.get(cacheKey);
    if (p && extractPostText(p.element).trim() !== text.trim()) {
      updatePostText(p.element, text);
      applied += 1;
    }
  }

  // Also try thread-root
  applyToThreadRoot();
  log.debug('fetch-edited-applied', { applied });
}

/**
 * Fallback trigger: resolve visible own posts even when the "Edited" badge is
 * not rendered in this surface (e.g. some search/profile variants).
 */
async function fetchOwnPostsInView(gen: number, posts?: PostInfo[]): Promise<void> {
  if (currentDid === null) {
    log.debug('fetch-own-skip', { reason: 'no-auth' });
    return;
  }

  const postsToFetch: Array<{ atUri: string; repo: string; rkey: string }> = [];
  let scanned = 0;
  let ownVisible = 0;
  let alreadyCached = 0;

  // Use a pre-computed posts snapshot from the caller when available to avoid
  // a redundant DOM scan in the synchronous scan phase.
  const scanPosts = posts ?? [...findPosts(document)];
  for (const postInfo of scanPosts) {
    scanned += 1;
    if (!isElementOwnPost(postInfo.element, postInfo.repo)) {
      continue;
    }

    ownVisible += 1;

    const cacheKey = normalizeCacheKey(postInfo.atUri, postInfo.repo);
    if (getCached(cacheKey) !== null) {
      alreadyCached += 1;
      continue;
    }

    postsToFetch.push({ atUri: postInfo.atUri, repo: postInfo.repo, rkey: postInfo.rkey });
  }

  if (postsToFetch.length === 0) {
    log.debug('fetch-own-skip', { reason: 'no-uncached-own-posts', scanned, ownVisible, alreadyCached });
    return;
  }

  log.debug('fetch-own-start', {
    currentDid,
    scanned,
    ownVisible,
    alreadyCached,
    postsToFetch: postsToFetch.map(p => ({ atUri: p.atUri, repo: p.repo, rkey: p.rkey })),
  });

  const results = await resolveBatch(postsToFetch);
  log.debug('fetch-own-resolved', { resultCount: results.size });

  // Discard stale results — a newer scan has already taken ownership.
  if (gen !== scanGeneration) {
    log.debug('fetch-own-stale', { gen, scanGeneration });
    return;
  }

  // Build a one-pass index of current DOM posts to avoid O(results × posts) scans.
  const postIndex = new Map<string, PostInfo>();
  for (const p of findPosts(document)) {
    postIndex.set(normalizeCacheKey(p.atUri, p.repo), p);
  }

  let applied = 0;
  for (const [cacheKey, text] of results) {
    const p = postIndex.get(cacheKey);
    if (p && extractPostText(p.element).trim() !== text.trim()) {
      updatePostText(p.element, text);
      applied += 1;
    }
  }

  const threadApplied = applyToThreadRoot();
  log.debug('fetch-own-applied', { applied, threadApplied });
}

/**
 * Trigger 3: LABEL_RECEIVED push from the service worker WebSocket.
 *
 * Label URIs always use the DID form (`at://did:plc:xyz/...`), but the DOM
 * may only contain handle-based URIs (e.g. from anchor hrefs). To bridge the
 * mismatch we:
 *   1. Resolve the DID to a handle and register the mapping so all future
 *      cache lookups work in both directions.
 *   2. Match DOM posts by rkey (+ collection) since the URI form may differ.
 */
async function handleLabelPush(uri: string): Promise<void> {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) {
    log.debug('label-push-parse-failed', { uri });
    return;
  }

  const repo = match[1]!;
  const collection = match[2]!;
  const rkey = match[3]!;

  // Resolve DID → handle and register the pair so the cache module can
  // translate between handle-form and DID-form keys.
  if (repo.startsWith('did:')) {
    try {
      const handle = await getHandleForDid(repo);
      if (handle) {
        registerIdentity(handle, repo);
        log.debug('label-push-resolved-identity', { did: repo, handle });
      }
    } catch {
      // Best-effort — continue without the mapping.
      log.debug('label-push-resolve-failed', { did: repo });
    }
  }

  const text = await resolveEditedText(uri, repo, collection, rkey);
  if (text === null) return;

  // Apply to DOM — match by rkey since the URI form in the DOM may differ
  // from the DID-based URI in the label notification.
  let applied = false;
  for (const p of findPosts(document)) {
    if (p.rkey === rkey && p.collection === collection) {
      const currentText = extractPostText(p.element).trim();
      if (currentText !== text.trim()) {
        updatePostText(p.element, text);
        applied = true;
      }
      break;
    }
  }

  // Thread-root fallback
  const threadApplied = applyToThreadRoot(text, rkey);
  log.debug('label-push-applied', { uri, applied, threadApplied });
}

const ensureRuntimeMessageListener = (): void => {
  if (runtimeMessageHandler !== null) return;

  runtimeMessageHandler = (msg: unknown): void => {
    const message = msg as { type?: string };
    if (message?.type === 'LABEL_RECEIVED') {
      const { uri } = msg as LabelReceivedNotification;
      if (typeof uri === 'string') {
        void handleLabelPush(uri);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener(runtimeMessageHandler as any);
};

const ACTION_AREA_SELECTORS = [
  '[data-testid="postButtonInline"]',
  'button[aria-label="Open post options menu"]',
  'button[data-testid="postDropdownBtn"]',
];

const isElementOwnPost = (postElement: HTMLElement, postRepo: string): boolean => {
  if (currentDid === null) {
    return false;
  }

  if (postRepo === currentDid || postRepo === currentHandle) {
    return true;
  }

  const dataTestId = postElement.getAttribute('data-testid') ?? '';
  if (
    dataTestId.includes(`by-${currentDid}`) ||
    (currentHandle !== null && dataTestId.includes(`by-${currentHandle}`))
  ) {
    return true;
  }

  const profileAnchors = postElement.querySelectorAll<HTMLAnchorElement>('a[href*="/profile/"]');
  for (const anchor of profileAnchors) {
    const href = anchor.getAttribute('href') ?? anchor.href;
    if (!href) continue;
    if (href.includes(`/profile/${currentDid}`)) return true;
    if (currentHandle !== null && href.includes(`/profile/${currentHandle}`)) return true;
  }

  return false;
};

// Debug: Log when content script loads
console.log(`${APP_NAME}: content script loaded on ${document.location.href}`);

let mutationObserver: MutationObserver | null = null;
let isApplyingCache = false;
let currentDid: string | null = null;
let currentHandle: string | null = null;
let domContentLoadedHandler: (() => void) | null = null;
let storageChangeHandler: ((changes: Record<string, Browser.storage.StorageChange>) => void) | null = null;
let runtimeMessageHandler: ((msg: unknown) => void) | null = null;
let scanScheduled = false;
let scanTimer: ReturnType<typeof setTimeout> | null = null;
let activeModal: EditModal | null = null;
let activeHistoryModal: EditHistoryModal | null = null;
// Monotonically-increasing scan generation. Async fetch functions capture the
// generation at dispatch time and abort their apply phase if a newer scan has
// since fired, preventing stale results from overwriting fresher DOM state.
let scanGeneration = 0;

// ── Phase F: SPA navigation + account auto-switch ─────────────────────────────

let knownAccounts: AuthListAccountsAccount[] = [];
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;
let navigationHandler: (() => void) | null = null;
let navigationToken = 0;

/** Selectors for the main feed container on bsky.app. */
const FEED_CONTAINER_SELECTORS = ['[data-testid="feed"]', '[data-testid="feedPage-feed"]', 'main', '[role="main"]'];

const getOrCreateEditModal = (): EditModal => {
  if (activeModal !== null && activeModal.element.isConnected) {
    return activeModal;
  }

  const modal = new EditModal();
  modal.element.setAttribute('data-skeeditor-modal', 'true');
  document.body.appendChild(modal.element);
  activeModal = modal;

  return modal;
};

const isPutRecordConflictResponse = (response: PutRecordResponse): response is PutRecordConflictResponse => {
  return response.type === 'PUT_RECORD_CONFLICT';
};

const refreshAuthState = async (): Promise<void> => {
  try {
    console.log(`${APP_NAME}: querying background for auth status...`);
    const status = await sendMessage({ type: 'AUTH_GET_STATUS' });
    console.log(`${APP_NAME}: received auth status response:`, status);
    currentDid = status.authenticated ? status.did : null;
    currentHandle = status.authenticated ? (status.handle ?? null) : null;
    setIdentity(currentDid, currentHandle);
    console.log(`${APP_NAME}: currentDid=${currentDid}, currentHandle=${currentHandle}`);
  } catch (err) {
    console.error(`${APP_NAME}: failed to load auth state`, err);
    currentDid = null;
    currentHandle = null;
    setIdentity(null, null);
  }

  // Trigger a scan for posts after updating auth state
  scanForPosts();
};

const loadKnownAccounts = async (): Promise<void> => {
  try {
    const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
    knownAccounts = response.accounts;
  } catch (err) {
    console.error(`${APP_NAME}: failed to load known accounts`, err);
    // Keep previous knownAccounts so auto-switch degrades gracefully on transient failures.
  }
};

/** Extract the profile identifier from a bsky.app-style URL or pathname. */
const extractProfileIdentifier = (url: string): string | null => {
  const match = /\/profile\/([^/?#]+)/.exec(url);
  return match?.[1] ?? null;
};

/**
 * If the URL points to a profile belonging to a non-active known account,
 * auto-switch to that account so edit buttons appear without a manual switch.
 *
 * A navigation token is captured at call time and checked before applying the
 * switch so that a stale completion from a rapid earlier navigation cannot
 * overwrite the correct account for the current URL.
 */
const checkProfileSwitch = async (url: string): Promise<void> => {
  const token = ++navigationToken;

  const identifier = extractProfileIdentifier(url);
  if (!identifier) return;

  if (knownAccounts.length === 0) {
    await loadKnownAccounts();
  }

  const account = knownAccounts.find(acc => !acc.isActive && (acc.handle === identifier || acc.did === identifier));
  if (!account) return;

  try {
    if (token !== navigationToken) return; // Already superseded before sending.
    await sendMessage({ type: 'AUTH_SWITCH_ACCOUNT', did: account.did });
    if (token !== navigationToken) return; // A newer navigation superseded this one.
    // Reload account list so isActive flags are up to date.
    await loadKnownAccounts();
    await refreshAuthState();
    removeInjectedElements();
    scheduleScanForPosts();
  } catch (err) {
    console.error(`${APP_NAME}: auto-switch failed`, err);
  }
};

const ensureNavigationListeners = (): void => {
  if (originalPushState !== null) return; // Already installed.

  // Store unbound originals so cleanup restores the exact same function references.
  originalPushState = history.pushState;
  originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>): void {
    originalPushState!.apply(history, args);
    scheduleScanForPosts();
    void checkProfileSwitch(location.href);
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>): void {
    originalReplaceState!.apply(history, args);
    scheduleScanForPosts();
    void checkProfileSwitch(location.href);
  };

  navigationHandler = (): void => {
    scheduleScanForPosts();
    void checkProfileSwitch(location.href);
  };

  window.addEventListener('popstate', navigationHandler);
};

const formatEditTimeLimit = (minutes: number): string => {
  if (minutes === 0.5) {
    return '30 seconds';
  }

  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
};

const exceedsEditTimeLimit = (createdAt: unknown, editTimeLimit: number | null): boolean => {
  if (editTimeLimit === null || typeof createdAt !== 'string') {
    return false;
  }

  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return Date.now() - createdAtMs > editTimeLimit * 60_000;
};

const handleEditClick = async (postElement: HTMLElement): Promise<void> => {
  const info = extractPostInfo(postElement);
  if (!info || (currentDid !== info.repo && currentHandle !== info.repo)) {
    return;
  }

  const modal = getOrCreateEditModal();
  const initialText = extractPostText(postElement);

  // Use the in-memory record cache when a save just happened (avoids stale AppView data from GET_RECORD).
  const nowMs = Date.now();
  const normalizedAtUri = normalizeCacheKey(info.atUri, info.repo);
  const cachedEntry = recentRecordsCache.get(normalizedAtUri);

  let currentRecord: EditablePostRecord;
  let currentCid: string | undefined;

  if (cachedEntry !== undefined && nowMs - cachedEntry.savedAt < RECORD_CACHE_TTL_MS) {
    currentRecord = cachedEntry.record;
    currentCid = cachedEntry.cid;
  } else {
    const recordResponse = await sendMessage({
      type: 'GET_RECORD',
      repo: info.repo,
      collection: info.collection,
      rkey: info.rkey,
    });

    if ('error' in recordResponse) {
      modal.open(initialText);
      modal.setError(recordResponse.error);
      return;
    }

    currentRecord = recordResponse.value as EditablePostRecord;
    currentCid = recordResponse.cid;
  }

  const initialRecordText = typeof currentRecord.text === 'string' ? currentRecord.text : initialText;

  const settingsResponse = await sendMessage({ type: 'GET_SETTINGS' });
  const editTimeLimit = 'error' in settingsResponse ? null : settingsResponse.editTimeLimit;
  const postDateStrategy = 'error' in settingsResponse ? 'update' : settingsResponse.postDateStrategy;

  if (exceedsEditTimeLimit(currentRecord.createdAt, editTimeLimit)) {
    modal.open(initialRecordText);
    modal.setEditable(false);
    modal.setError(`This post is older than your edit time limit of ${formatEditTimeLimit(editTimeLimit!)}.`);
    return;
  }

  modal.open(initialRecordText, undefined, async text => {
    const uploadedMedia = modal.getUploadedMedia();
    const updatedRecord = buildUpdatedPostRecord(currentRecord, text, uploadedMedia, {
      updateCreatedAt: postDateStrategy === 'update',
    });

    // Upload media files if any
    if (uploadedMedia.length > 0) {
      try {
        const uploadPromises = uploadedMedia.map(async file => {
          const arrayBuffer = await file.arrayBuffer();
          return sendMessage({
            type: 'UPLOAD_BLOB',
            data: arrayBuffer,
            mimeType: file.type || 'application/octet-stream',
            repo: info.repo,
          });
        });

        const uploadResults = await Promise.all(uploadPromises);

        // Update the embed with the actual blob references
        if (updatedRecord.embed && 'images' in updatedRecord.embed) {
          updatedRecord.embed.images = updatedRecord.embed.images.map((image, index) => {
            const result = uploadResults[index];
            if (!result || 'error' in result)
              throw new Error(result && 'error' in result ? result.error : 'Upload failed');
            return { ...image, image: result.blobRef };
          });
        } else if (updatedRecord.embed && 'video' in updatedRecord.embed) {
          const result = uploadResults[0];
          if (!result || 'error' in result)
            throw new Error(result && 'error' in result ? result.error : 'Upload failed');
          updatedRecord.embed.video = result.blobRef;
        }
      } catch (error) {
        console.error('Error uploading media:', error);
        modal.setError('Failed to upload media. Please try again.');
        return;
      }
    }

    const validationResult = validateUpdatedPostRecord(updatedRecord);
    if (!validationResult.success) {
      modal.setError(validationResult.error);
      return;
    }

    const validatedRecord = validationResult.value;

    // Create a history record for the old version before modifying the post!
    try {
      // Resolve to DID-form so the postUri stored in the archive record is canonical
      // and not subject to handle changes.
      const resolvedRepo = info.repo === currentHandle && currentDid !== null ? currentDid : info.repo;
      await sendMessage({
        type: 'CREATE_RECORD',
        repo: resolvedRepo,
        collection: 'agency.self.skeeditor.postVersion',
        record: {
          $type: 'agency.self.skeeditor.postVersion',
          postUri: `at://${resolvedRepo}/${info.collection}/${info.rkey}`,
          postCid: currentCid,
          text: currentRecord.text,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('Failed to archive previous post version:', err);
      // We do not abort the actual edit if archiving fails.
    }

    const writeResponse = await sendMessage({
      type: 'PUT_RECORD',
      repo: info.repo,
      collection: info.collection,
      rkey: info.rkey,
      record: validatedRecord,
      swapRecord: currentCid,
    });

    if (writeResponse.type === 'PUT_RECORD_ERROR') {
      if (writeResponse.requiresReauth) {
        modal.setError(
          'Your session has expired or lacks permission. Please click the extension icon to sign in again.',
        );
        await refreshAuthState();
        return;
      }
      modal.setError(writeResponse.message);
      return;
    }

    if (isPutRecordConflictResponse(writeResponse)) {
      const conflictMessage = writeResponse.conflict
        ? 'This post changed while you were editing. Reload to compare the latest version.'
        : 'This post changed while you were editing. Please reload and try again.';

      modal.setError(conflictMessage);
      return;
    }

    modal.close();
    updatePostText(postElement, text);
    if (postDateStrategy === 'update') {
      updatePostTimestamp(postElement, validatedRecord.createdAt);
    }
    // Normalize to DID form so cache lookups succeed regardless of whether the
    // post was found via handle-form or DID-form URL.
    const normalizedAtUri = normalizeCacheKey(info.atUri, info.repo);
    // Write to cache immediately — the MO path will keep applying the cached
    // text on React re-renders. No setTimeout hack needed.
    setCached(normalizedAtUri, text, initialRecordText);
    recentRecordsCache.set(normalizedAtUri, { record: validatedRecord, cid: writeResponse.cid, savedAt: Date.now() });
    const toastMsg = postDateStrategy === 'update' ? 'Edit saved. Post date updated.' : 'Edit saved.';
    showToast(toastMsg);
    console.info(`${APP_NAME}: edit saved`, { atUri: normalizedAtUri, uri: writeResponse.uri, cid: writeResponse.cid });
  });
};

const hasActionArea = (postElement: HTMLElement): boolean =>
  ACTION_AREA_SELECTORS.some(selector => postElement.querySelector<HTMLElement>(selector) !== null);

const waitForActionArea = (postElement: HTMLElement): Promise<void> => {
  if (hasActionArea(postElement)) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (hasActionArea(postElement)) {
        cleanup();
        resolve();
      }
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      observer.disconnect();
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ACTION_AREA_WAIT_TIMEOUT);

    observer.observe(postElement, { childList: true, subtree: true });
  });
};

const createEditButton = (): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute(EDIT_BUTTON_ATTRIBUTE, 'true');
  button.className = 'skeeditor-edit-button';
  button.setAttribute('aria-label', 'Edit post');
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;
  return button;
};

const placeEditButton = (postElement: HTMLElement, button: HTMLButtonElement): void => {
  // Find the options menu button (three dots) - we want to place edit right next to it
  const optionsButton = postElement.querySelector<HTMLElement>('button[aria-label="Open post options menu"]');
  const optionsContainer = optionsButton?.parentElement;

  if (optionsContainer && optionsButton) {
    if (optionsContainer.querySelectorAll('button').length > 1) {
      // Options button is a direct child of the action row — insert button directly
      // before the options button so it appears as an adjacent sibling.
      optionsContainer.insertBefore(button, optionsButton);
    } else {
      // Options button lives in its own wrapper div (real Bluesky structure like
      // "css-g5y9jx"). Create a matching wrapper and insert it before that wrapper.
      const editWrapper = document.createElement('div');
      editWrapper.className = optionsContainer.className;
      editWrapper.appendChild(button);
      optionsContainer.parentElement?.insertBefore(editWrapper, optionsContainer);
    }
  } else {
    // Fallback: find the action container with like/reply/repost buttons
    const actionContainer = postElement.querySelector<HTMLElement>('[data-testid="postButtonInline"]');
    if (actionContainer) {
      actionContainer.appendChild(button);
    } else {
      postElement.appendChild(button);
    }
  }
};

const injectEditButton = (postElement: HTMLElement): void => {
  if (postElement.hasAttribute(POST_MARKER_ATTRIBUTE) || postElement.querySelector(`[${EDIT_BUTTON_ATTRIBUTE}]`)) {
    return;
  }

  postElement.setAttribute(POST_MARKER_ATTRIBUTE, 'pending');

  const finalizeInjection = (): void => {
    if (postElement.querySelector(`[${EDIT_BUTTON_ATTRIBUTE}]`)) {
      postElement.setAttribute(POST_MARKER_ATTRIBUTE, 'true');
      return;
    }

    const button = createEditButton();
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void handleEditClick(postElement).catch(error => {
        console.error(`${APP_NAME}: failed to handle edit click`, error);
      });
    });

    placeEditButton(postElement, button);
    postElement.setAttribute(POST_MARKER_ATTRIBUTE, 'true');
  };

  void waitForActionArea(postElement).then(finalizeInjection);
};

const getOrCreateHistoryModal = (): EditHistoryModal => {
  if (activeHistoryModal !== null && activeHistoryModal.element.isConnected) {
    return activeHistoryModal;
  }
  const modal = new EditHistoryModal();
  modal.element.setAttribute('data-skeeditor-history-modal', 'true');
  activeHistoryModal = modal;
  return modal;
};

/** Extract the display date from the "Archived post" button text.
 *  Button text is: "Archived from Mar 28, 2026, 11:31 PM" — strip the prefix. */
const parseArchivedDateText = (button: HTMLElement): string => {
  const text = button.textContent ?? '';
  const prefix = 'Archived from ';
  const idx = text.indexOf(prefix);
  return idx !== -1 ? text.slice(idx + prefix.length).trim() : text.trim();
};

const moveEditedBadgeNearArchived = (postElement: HTMLElement): void => {
  const archivedButton = postElement.querySelector<HTMLElement>('button[aria-label="Archived post"]');
  const editedButton = postElement.querySelector<HTMLElement>('button[aria-label="Edited"]');

  if (!archivedButton || !editedButton || archivedButton === editedButton) {
    return;
  }

  const archivedParent = archivedButton.parentElement;
  if (!archivedParent) return;

  if (editedButton.parentElement !== archivedParent || editedButton.nextElementSibling !== archivedButton) {
    archivedParent.insertBefore(editedButton, archivedButton);
  }
};

/** Intercept all "Edited" and "Archived post" buttons not yet processed by skeeditor. */
const interceptArchivedPostButtons = (posts?: PostInfo[]): void => {
  if (currentDid === null && currentHandle === null) return;

  const archivedButtons = document.querySelectorAll<HTMLElement>(
    `button[aria-label="Archived post"]:not([${ARCHIVED_BUTTON_ATTRIBUTE}])`,
  );
  const editedButtons = document.querySelectorAll<HTMLElement>(
    `button[aria-label="Edited"]:not([${EDITED_BUTTON_ATTRIBUTE}])`,
  );

  const buttons = [...archivedButtons, ...editedButtons];

  for (const btn of buttons) {
    const isArchivedButton = btn.getAttribute('aria-label') === 'Archived post';
    btn.setAttribute(isArchivedButton ? ARCHIVED_BUTTON_ATTRIBUTE : EDITED_BUTTON_ATTRIBUTE, 'true');

    btn.addEventListener(
      'click',
      async event => {
        // Find the post container to get the AT-URI + repo.
        const postElement =
          btn.closest<HTMLElement>('[data-at-uri]') ??
          btn.closest<HTMLElement>('[data-uri]') ??
          btn.closest<HTMLElement>('[data-testid^="postThreadItem"]') ??
          btn.closest<HTMLElement>('[data-testid^="feedItem"]') ??
          btn.closest<HTMLElement>('article');

        if (!postElement) {
          // Unknown context — preserve native Bluesky behavior.
          return;
        }

        const info = extractPostInfo(postElement);
        if (!info) {
          // Unknown context — preserve native Bluesky behavior.
          return;
        }

        // Only hijack badges on the current user's own posts.
        if (info.repo !== currentDid && info.repo !== currentHandle) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const archivedButton = isArchivedButton
          ? btn
          : (postElement.querySelector<HTMLElement>('button[aria-label="Archived post"]') ?? null);
        const originalDate = archivedButton ? parseArchivedDateText(archivedButton) : 'Unknown original date';
        const modal = getOrCreateHistoryModal();
        modal.open(originalDate);

        try {
          // Resolve to DID form so listRecords targets the right repo.
          const repo = info.repo === currentHandle && currentDid !== null ? currentDid : info.repo;
          const postUri = `at://${repo}/${info.collection}/${info.rkey}`;

          // Fetch all postVersion records for this user and filter by postUri.
          // listRecords doesn't support field-level filtering so we do it client-side.
          const response = await sendMessage({
            type: 'LIST_RECORDS',
            repo,
            collection: 'agency.self.skeeditor.postVersion',
            limit: 100,
          });

          if ('error' in response) {
            modal.showError('Could not load edit history.');
            return;
          }

          const versions = response.records
            .filter(r => (r.value as Record<string, unknown>)['postUri'] === postUri)
            .sort((a, b) => {
              const aDate = String((a.value as Record<string, unknown>)['createdAt'] ?? '');
              const bDate = String((b.value as Record<string, unknown>)['createdAt'] ?? '');
              return aDate.localeCompare(bDate);
            })
            .map(r => ({
              text: String((r.value as Record<string, unknown>)['text'] ?? ''),
              editedAt: String((r.value as Record<string, unknown>)['createdAt'] ?? ''),
            }));

          // User asked for original version in this modal.
          if (versions.length > 0) {
            modal.showVersions([versions[0]!]);
          } else {
            modal.showVersions([]);
          }
        } catch (err) {
          console.error(`${APP_NAME}: failed to load edit history`, err);
          modal.showError('Could not load edit history.');
        }
      },
      true,
    ); // capture phase so we beat Bluesky's own handler
  }

  // Also keep the Edited badge visually aligned next to Archived post when both exist.
  for (const post of posts ?? findPosts(document)) {
    moveEditedBadgeNearArchived(post.element);
  }
};

const scanForPosts = (): void => {
  // Increment generation so any in-flight async fetches from a previous scan
  // will discard their results rather than apply stale text.
  const gen = ++scanGeneration;

  // Compute the post list lazily: only do the DOM scan when there is a reason to.
  // On anonymous/idle pages (no auth, empty cache) every sub-function returns
  // early before touching posts, so skip the scan entirely.
  //   - applyEditedPostsFromCache  (needs posts only when cache is non-empty)
  //   - fetchOwnPostsInView        (gates on currentDid !== null)
  //   - fetchPermalinkPost         (falls back to its own scan if posts is undefined)
  //   - edit-button injection loop (gates on currentDid !== null)
  const posts: PostInfo[] | undefined =
    getCacheSize() > 0 || currentDid !== null ? [...findPosts(document)] : undefined;

  // Always re-apply persisted text edits — React may have re-rendered since last time.
  applyEditedPostsFromCache(posts);

  // Intercept "Archived post" button clicks to show our edit history modal.
  // (and edited badges on own posts)
  interceptArchivedPostButtons(posts);

  console.log(`${APP_NAME}: scanning for posts, currentDid=${currentDid}, currentHandle=${currentHandle}`);

  // Trigger 2: detect "Edited" badges in the DOM and fetch from Slingshot.
  // This runs async — the MO path will apply the results once they land in cache.
  void fetchEditedPostsInView(gen);

  // Fallback trigger: own posts should still resolve even when this surface
  // does not render the Edited badge.  Pass the pre-computed posts list for
  // the synchronous scan phase; the async apply phase will re-query the DOM.
  void fetchOwnPostsInView(gen, posts);

  // Trigger 1: on permalink pages, always fetch the thread root.
  void fetchPermalinkPost(gen, posts);

  // No authenticated DID → don't inject any edit buttons.
  if (currentDid === null) {
    console.log(`${APP_NAME}: no auth session, skipping edit button injection`);
    log.debug('scan-no-auth');
    return;
  }

  let visiblePosts = 0;
  let ownPosts = 0;

  // posts is always defined when currentDid !== null (see lazy guard above).
  for (const postInfo of posts ?? []) {
    visiblePosts += 1;
    if (!isElementOwnPost(postInfo.element, postInfo.repo)) {
      continue;
    }
    ownPosts += 1;

    injectEditButton(postInfo.element);
  }

  if (visiblePosts === 0) {
    // Dump DOM diagnostics so we can see WHY no posts matched
    const diagnosticSelectors = [
      '[data-at-uri]',
      '[data-uri]',
      '[data-post]',
      '[data-testid="post"]',
      '[data-testid="feedItem"]',
      '[data-testid="postThreadItem"]',
      '[data-testid^="feedItem"]',
      '[data-testid^="postThreadItem"]',
      '[role="article"]',
      'article',
      '[data-testid]',
    ];
    const selectorCounts = new Map<string, number>();
    for (const sel of diagnosticSelectors) {
      selectorCounts.set(sel, document.querySelectorAll(sel).length);
    }
    // Grab all data-testid values on the page for inspection
    const allTestIds = Array.from(document.querySelectorAll('[data-testid]'))
      .map(el => el.getAttribute('data-testid')!)
      .filter(Boolean);
    const uniqueTestIds = [...new Set(allTestIds)].slice(0, 50);
    // Check for main/feed containers
    const mainEl = document.querySelector('main');
    const feedEl = document.querySelector('[data-testid="feed"]');
    log.debug('scan-no-containers', {
      pathname: location.pathname,
      href: location.href,
      currentDid,
      currentHandle,
      selectorCounts: Object.fromEntries(selectorCounts),
      uniqueTestIds,
      hasMain: !!mainEl,
      mainChildCount: mainEl?.children.length ?? 0,
      hasFeed: !!feedEl,
      feedChildCount: feedEl?.children.length ?? 0,
      bodyChildCount: document.body.children.length,
      articleCount: document.querySelectorAll('article').length,
    });
  }

  log.debug('scan-summary', { currentDid, currentHandle, visiblePosts, ownPosts });
};

export const scheduleScanForPosts = (): void => {
  if (scanScheduled) {
    return;
  }

  scanScheduled = true;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scanScheduled = false;
    scanForPosts();
  }, 100);
};

const findObserverTarget = (): Element => {
  for (const selector of FEED_CONTAINER_SELECTORS) {
    const target = document.querySelector(selector);
    if (target) return target;
  }
  return document.body;
};

/** Remove all edit buttons and processed markers injected by this content script. */
const removeInjectedElements = (): void => {
  document.querySelectorAll<HTMLElement>(`[${EDIT_BUTTON_ATTRIBUTE}]`).forEach(el => el.remove());
  document.querySelectorAll<HTMLElement>(`[${POST_MARKER_ATTRIBUTE}]`).forEach(el => {
    el.removeAttribute(POST_MARKER_ATTRIBUTE);
  });
};

const dismissActiveModal = (): void => {
  if (activeModal !== null) {
    activeModal.close();
    activeModal = null;
  }
};

const ensureStorageListener = (): void => {
  if (storageChangeHandler !== null) {
    return;
  }

  storageChangeHandler = (changes: Record<string, Browser.storage.StorageChange>) => {
    if (!('sessions' in changes) && !('activeDid' in changes)) {
      return;
    }

    // Detect sign-out: active DID cleared or all sessions wiped.
    const activeDidCleared = 'activeDid' in changes && changes['activeDid']?.newValue == null;
    const sessionsCleared = 'sessions' in changes && changes['sessions']?.newValue == null;

    if (activeDidCleared || sessionsCleared) {
      currentDid = null;
      currentHandle = null;
      setIdentity(null, null);
      dismissActiveModal();
      removeInjectedElements();
      return;
    }

    // Session added/updated or account switched — re-check auth and re-scan.
    void refreshAuthState()
      .then(() => scheduleScanForPosts())
      .catch(err => console.error(`${APP_NAME}: storage refresh failed`, err));
  };

  browser.storage.onChanged.addListener(storageChangeHandler);
};

// ── "Edited" label dialog injection ─────────────────────────────────────────
//
// When the user clicks Bluesky's "Edited" label chip, the app adds a
// "Moderation details" dialog to the DOM.  We intercept the click to identify
// the originating post, look up the original text from the cache, and inject
// it into the dialog once it appears.

let pendingOriginalText: string | null = null;
let editedLabelListenerAttached = false;
let editedLabelClickHandler: ((event: MouseEvent) => void) | null = null;

const ensureEditedLabelListener = (): void => {
  if (editedLabelListenerAttached) return;
  editedLabelListenerAttached = true;

  // Use capture phase so we fire before Bluesky's own React synthetic handlers.
  editedLabelClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const editedButton = target.closest('button[aria-label="Edited"]') as HTMLElement | null;
    if (!editedButton) return;

    // Trace up to closest post container to find the AT-URI.
    const postElement =
      editedButton.closest<HTMLElement>('[data-at-uri]') ??
      editedButton.closest<HTMLElement>('[data-uri]') ??
      editedButton.closest<HTMLElement>('article');
    if (!postElement) return;

    const info = extractPostInfo(postElement);
    if (!info) return;

    const cacheKey = normalizeCacheKey(info.atUri, info.repo);
    pendingOriginalText = getCached(cacheKey)?.originalText ?? null;
  };

  document.addEventListener('click', editedLabelClickHandler, true);
};

const injectOriginalTextIntoDialog = (): void => {
  if (pendingOriginalText === null) return;

  const dialog = document.querySelector<HTMLElement>('[aria-label="Moderation details"][role="dialog"]');
  if (!dialog) return;

  // Idempotent — don't inject twice.
  if (dialog.querySelector('.skeeditor-original-text')) return;

  // The description span is the best anchor — insert our block right after it.
  const bodySpan = dialog.querySelector<HTMLElement>('span');
  if (!bodySpan) return;

  const originalText = pendingOriginalText;
  pendingOriginalText = null; // consume

  const wrapper = document.createElement('div');
  wrapper.className = 'skeeditor-original-text';
  wrapper.style.cssText = 'margin-top:12px;padding:10px 12px;background:rgba(255,255,255,0.06);border-radius:8px;';

  const label = document.createElement('div');
  label.style.cssText =
    'font-size:11px;color:rgb(171,184,201);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;';
  label.textContent = 'Original text';

  const body = document.createElement('div');
  body.style.cssText = 'font-size:15px;line-height:21px;color:rgb(255,255,255);white-space:pre-wrap;';
  body.textContent = originalText;

  wrapper.appendChild(label);
  wrapper.appendChild(body);

  // Insert after the span but still inside its parent container.
  bodySpan.parentElement?.appendChild(wrapper);
};

const ensureObserver = (): void => {
  if (mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver(() => {
    // Guard against re-entrant calls: applyEditedPostsFromCache() calls updatePostText()
    // which causes DOM mutations that would otherwise retrigger this observer infinitely.
    if (isApplyingCache) return;
    isApplyingCache = true;
    try {
      // Re-apply cached text immediately so React re-renders don't produce a visible flicker.
      applyEditedPostsFromCache();
      // Inject original text into Bluesky's "Edited" moderation dialog if one just appeared.
      injectOriginalTextIntoDialog();
    } finally {
      isApplyingCache = false;
    }
    // Debounced scan for edit-button injection (more expensive).
    scheduleScanForPosts();
  });

  const target = findObserverTarget();
  mutationObserver.observe(target, { childList: true, subtree: true });
};

let hasStarted = false;

export const start = (): void => {
  if (hasStarted) return;
  hasStarted = true;

  // Initialize the cache module's storage backend.
  setStorage(browser.storage.local);

  ensureObserver();
  ensureStorageListener();
  ensureRuntimeMessageListener();
  ensureNavigationListeners();
  ensureEditedLabelListener();

  // Connect a persistent port to keep the background SW alive (Chrome MV3 terminates
  // idle SWs after ~30 s; an open port prevents that while the page is active).
  // The SW posts SW_READY on the port once its onMessage handler is registered —
  // we await that signal before sending auth messages to eliminate the cold-start race.
  const waitForSwReady = (): Promise<void> =>
    new Promise(resolve => {
      let settled = false;
      const done = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      // Fallback: if SW_READY never arrives within 8 s, proceed anyway and let
      // the retry-with-backoff in sendMessage handle any remaining startup lag.
      // 8 s gives Chrome's MV3 SW enough time to cold-start even on a slower
      // machine parsing the ~280 kB background bundle.
      const fallback = setTimeout(done, 8000);

      const isContextInvalidated = (): boolean => {
        try {
          // Accessing browser.runtime.id throws when context is invalidated.
          return !browser.runtime.id;
        } catch {
          return true;
        }
      };

      const connect = (): void => {
        if (settled || isContextInvalidated()) {
          clearTimeout(fallback);
          done();
          return;
        }
        let port: ReturnType<typeof browser.runtime.connect>;
        try {
          port = browser.runtime.connect({ name: 'keepalive' });
        } catch {
          // Context was invalidated between the check and the connect call.
          clearTimeout(fallback);
          done();
          return;
        }
        port.onMessage.addListener((msg: unknown) => {
          if ((msg as { type?: string })?.type === 'SW_READY') {
            clearTimeout(fallback);
            done();
          }
        });
        port.onDisconnect.addListener(() => {
          // SW was terminated; reconnect and wait for the next SW_READY.
          // 300 ms is fast enough to catch a restarting SW without hammering it.
          // Stop reconnecting if the extension context was invalidated (tab still
          // open after the extension was reloaded from chrome://extensions).
          if (!settled && !isContextInvalidated()) {
            setTimeout(connect, 300);
          } else {
            clearTimeout(fallback);
            done();
          }
        });
      };
      connect();
    });

  void waitForSwReady()
    .then(() => Promise.all([refreshAuthState(), loadKnownAccounts(), loadFromStorage()]))
    .then(async () => {
      log.debug('start-ready', { pathname: location.pathname, search: location.search });
      // On first page load (not just SPA navigation), ensure active account
      // matches the profile currently being viewed.
      await checkProfileSwitch(location.href);

      scanForPosts();

      // scanForPosts() already triggers fetchPermalinkPost() and
      // fetchEditedPostsInView() — no separate call needed.

      document.documentElement.setAttribute('data-skeeditor-initialized', 'true');
      console.info(`${APP_NAME}: content script loaded`);
    })
    .catch(error => {
      console.error(`${APP_NAME}: failed to load auth state`, error);
      log.debug('start-fallback-anonymous', {
        pathname: location.pathname,
        message: error instanceof Error ? error.message : String(error),
      });
      scanForPosts();
      document.documentElement.setAttribute('data-skeeditor-initialized', 'true');
      console.info(`${APP_NAME}: content script loaded with anonymous state`);
    });
};

export const cleanupContentScript = (): void => {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }

  mutationObserver?.disconnect();
  mutationObserver = null;
  scanScheduled = false;

  if (domContentLoadedHandler) {
    document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    domContentLoadedHandler = null;
  }

  if (storageChangeHandler !== null) {
    browser.storage.onChanged.removeListener(storageChangeHandler);
    storageChangeHandler = null;
  }

  if (runtimeMessageHandler !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser.runtime.onMessage.removeListener(runtimeMessageHandler as any);
    runtimeMessageHandler = null;
  }

  // Restore patched history methods and remove popstate listener.
  if (originalPushState !== null) {
    history.pushState = originalPushState;
    originalPushState = null;
  }
  if (originalReplaceState !== null) {
    history.replaceState = originalReplaceState;
    originalReplaceState = null;
  }
  if (navigationHandler !== null) {
    window.removeEventListener('popstate', navigationHandler);
    navigationHandler = null;
  }

  dismissActiveModal();

  currentDid = null;
  currentHandle = null;
  setIdentity(null, null);
  knownAccounts = [];
  hasStarted = false;
  // Invalidate any in-flight async fetches from the previous lifecycle.
  // After cleanup a new start() will increment this value again, so stale
  // fetches that arrive between cleanup and re-start discard their results.
  scanGeneration++;

  if (editedLabelClickHandler !== null) {
    document.removeEventListener('click', editedLabelClickHandler, true);
    editedLabelClickHandler = null;
  }
  editedLabelListenerAttached = false;
  pendingOriginalText = null;
};

// Auto-execute when the module is loaded directly (tests and non-WXT environments).
// The WXT entrypoint calls start() explicitly via main(); the hasStarted guard
// prevents double-initialisation.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
