import { browser, type Browser } from 'wxt/browser';
import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME } from '../shared/constants';
import type {
  AuthListAccountsAccount,
  LabelReceivedNotification,
  PutRecordConflictResponse,
  PutRecordResponse,
} from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { EditModal } from './edit-modal';
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
import { extractPostInfo, extractPostText, findPosts, updatePostText } from './post-detector';
import { buildUpdatedPostRecord, type EditablePostRecord } from './post-editor';
import { getHandleForDid } from '../shared/api/resolve-did';
import './styles.css';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';
const ACTION_AREA_WAIT_TIMEOUT = 3000;
const DEBUG_LOCAL_STORAGE_KEY = 'skeeditor:debug';
const DEBUG_QUERY_PARAM = 'skeeditor_debug';
const DEBUG_DATA_ATTRIBUTE = 'data-skeeditor-debug';

const isDebugEnabled = (): boolean => {
  try {
    if (document.documentElement.getAttribute(DEBUG_DATA_ATTRIBUTE) === '1') return true;
  } catch {
    // noop
  }

  try {
    if (window.localStorage.getItem(DEBUG_LOCAL_STORAGE_KEY) === '1') return true;
  } catch {
    // localStorage may be unavailable in some privacy modes.
  }

  const value = new URLSearchParams(location.search).get(DEBUG_QUERY_PARAM);
  return value === '1' || value === 'true';
};

const debugLog = (event: string, data?: Record<string, unknown>): void => {
  if (!isDebugEnabled()) return;
  const prefix = `${APP_NAME}:debug:${event}`;
  if (data === undefined) {
    console.debug(prefix);
    return;
  }
  console.debug(prefix, data);
};

// ── Recent record cache (avoids stale GET_RECORD after a fresh save) ──────────

const RECORD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface RecentRecordEntry {
  record: EditablePostRecord;
  cid: string;
  savedAt: number;
}

const recentRecordsCache = new Map<string, RecentRecordEntry>();

function applyEditedPostsFromCache(): void {
  if (getCacheSize() === 0) return;

  let scanned = 0;
  let cacheHits = 0;
  let applied = 0;

  // ── 1. Normal path: findPosts() covers feed items, replies, search results,
  //       list views, notifications — anything with a recognisable container.
  for (const postInfo of findPosts(document)) {
    scanned += 1;
    const cacheKey = normalizeCacheKey(postInfo.atUri, postInfo.repo);
    const entry = getCached(cacheKey);
    if (entry !== null) {
      cacheHits += 1;
      if (extractPostText(postInfo.element).trim() !== entry.text.trim()) {
        updatePostText(postInfo.element, entry.text);
        applied += 1;
      }
    }
  }

  // ── 2. Thread-root fallback for post permalink pages.
  const threadApplied = applyToThreadRoot();
  debugLog('apply-cache', { cacheSize: getCacheSize(), scanned, cacheHits, applied, threadApplied });
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

  // Find the thread root's text element specifically — the first post in
  // a thread view is the root. Use findPosts to match by rkey rather than
  // blindly taking the first POST_TEXT_QUERY match (which could be a reply).
  for (const p of findPosts(document)) {
    if (p.rkey === urlRkey) {
      if (extractPostText(p.element).trim() !== resolvedText.trim()) {
        updatePostText(p.element, resolvedText);
      }
      return true;
    }
  }

  // Fallback: if findPosts doesn't find the thread root (DOM not fully rendered),
  // try the first detailed-text element (permalink pages have a distinct testid).
  const detailedTextEl = document.querySelector<HTMLElement>('[data-testid="postDetailedText"]');
  if (detailedTextEl && detailedTextEl.textContent?.trim() !== resolvedText) {
    detailedTextEl.textContent = resolvedText;
    return true;
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
async function fetchPermalinkPost(): Promise<void> {
  const urlMatch = /\/profile\/([^/?#]+)\/post\/([^/?#]+)/.exec(window.location.pathname);
  if (!urlMatch) {
    debugLog('fetch-permalink-skip', { reason: 'not-permalink', pathname: window.location.pathname });
    return;
  }

  // Only fetch if the thread root has an "Edited" badge
  const editedBadge = document.querySelector('button[aria-label="Edited"]');
  if (!editedBadge) {
    debugLog('fetch-permalink-skip', { reason: 'no-edited-badge', pathname: window.location.pathname });
    return;
  }

  const repo = urlMatch[1]!;
  const rkey = urlMatch[2]!;
  const atUri = `at://${repo}/${APP_BSKY_FEED_POST_COLLECTION}/${rkey}`;
  debugLog('fetch-permalink-start', { atUri, repo, rkey });

  const text = await resolveEditedText(atUri, repo, APP_BSKY_FEED_POST_COLLECTION, rkey);
  if (text !== null) {
    applyToThreadRoot(text, rkey);
    // Also try findPosts in case the DOM has rendered
    const atCacheKey = normalizeCacheKey(atUri, repo);
    for (const p of findPosts(document)) {
      const cacheKey = normalizeCacheKey(p.atUri, p.repo);
      if (cacheKey === atCacheKey && extractPostText(p.element).trim() !== text.trim()) {
        updatePostText(p.element, text);
        break;
      }
    }
    debugLog('fetch-permalink-applied', { atUri, textLength: text.length });
  } else {
    debugLog('fetch-permalink-miss', { atUri });
  }
}

/**
 * Trigger 2: DOM scan for "Edited" badge — bsky.app renders
 * `button[aria-label="Edited"]` for posts labeled as edited.
 */
async function fetchEditedPostsInView(): Promise<void> {
  const editedButtons = document.querySelectorAll<HTMLElement>('button[aria-label="Edited"]');
  if (editedButtons.length === 0) {
    debugLog('fetch-edited-skip', { reason: 'no-edited-buttons' });
    return;
  }

  const postsToFetch: Array<{ atUri: string; repo: string; rkey: string }> = [];

  for (const btn of editedButtons) {
    // Walk up to the nearest post container
    const postElement =
      btn.closest<HTMLElement>('[data-at-uri]') ??
      btn.closest<HTMLElement>('[data-uri]') ??
      btn.closest<HTMLElement>('article');
    if (!postElement) continue;

    const info = extractPostInfo(postElement);
    if (!info) continue;

    const cacheKey = normalizeCacheKey(info.atUri, info.repo);
    // Skip if already cached (cache module handles TTL)
    if (getCached(cacheKey) !== null) continue;

    postsToFetch.push({ atUri: info.atUri, repo: info.repo, rkey: info.rkey });
  }

  if (postsToFetch.length === 0) {
    debugLog('fetch-edited-skip', { reason: 'no-uncached-posts', editedButtonCount: editedButtons.length });
    return;
  }

  debugLog('fetch-edited-start', {
    editedButtonCount: editedButtons.length,
    postsToFetch: postsToFetch.map(p => ({ atUri: p.atUri, repo: p.repo, rkey: p.rkey })),
  });

  const results = await resolveBatch(postsToFetch);
  debugLog('fetch-edited-resolved', { resultCount: results.size });

  // Apply resolved text to DOM
  let applied = 0;
  for (const [cacheKey, text] of results) {
    for (const p of findPosts(document)) {
      if (normalizeCacheKey(p.atUri, p.repo) === cacheKey) {
        if (extractPostText(p.element).trim() !== text.trim()) {
          updatePostText(p.element, text);
          applied += 1;
        }
        break;
      }
    }
  }

  // Also try thread-root
  applyToThreadRoot();
  debugLog('fetch-edited-applied', { applied });
}

/**
 * Fallback trigger: resolve visible own posts even when the "Edited" badge is
 * not rendered in this surface (e.g. some search/profile variants).
 */
async function fetchOwnPostsInView(): Promise<void> {
  if (currentDid === null) {
    debugLog('fetch-own-skip', { reason: 'no-auth' });
    return;
  }

  const postsToFetch: Array<{ atUri: string; repo: string; rkey: string }> = [];
  let scanned = 0;
  let ownVisible = 0;
  let alreadyCached = 0;

  for (const postInfo of findPosts(document)) {
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
    debugLog('fetch-own-skip', { reason: 'no-uncached-own-posts', scanned, ownVisible, alreadyCached });
    return;
  }

  debugLog('fetch-own-start', {
    currentDid,
    scanned,
    ownVisible,
    alreadyCached,
    postsToFetch: postsToFetch.map(p => ({ atUri: p.atUri, repo: p.repo, rkey: p.rkey })),
  });

  const results = await resolveBatch(postsToFetch);
  debugLog('fetch-own-resolved', { resultCount: results.size });

  let applied = 0;
  for (const [cacheKey, text] of results) {
    for (const p of findPosts(document)) {
      if (normalizeCacheKey(p.atUri, p.repo) === cacheKey) {
        if (extractPostText(p.element).trim() !== text.trim()) {
          updatePostText(p.element, text);
          applied += 1;
        }
        break;
      }
    }
  }

  const threadApplied = applyToThreadRoot();
  debugLog('fetch-own-applied', { applied, threadApplied });
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
  if (!match) return;

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
        debugLog('label-push-resolved-identity', { did: repo, handle });
      }
    } catch {
      // Best-effort — continue without the mapping.
      debugLog('label-push-resolve-failed', { did: repo });
    }
  }

  const text = await resolveEditedText(uri, repo, collection, rkey);
  if (text === null) return;

  // Apply to DOM — match by rkey since the URI form in the DOM may differ
  // from the DID-based URI in the label notification.
  for (const p of findPosts(document)) {
    if (p.rkey === rkey && p.collection === collection) {
      if (extractPostText(p.element).trim() !== text.trim()) {
        updatePostText(p.element, text);
      }
      break;
    }
  }

  // Thread-root fallback
  applyToThreadRoot(text, rkey);
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
let currentDid: string | null = null;
let currentHandle: string | null = null;
let domContentLoadedHandler: (() => void) | null = null;
let storageChangeHandler: ((changes: Record<string, Browser.storage.StorageChange>) => void) | null = null;
let runtimeMessageHandler: ((msg: unknown) => void) | null = null;
let scanScheduled = false;
let scanTimer: ReturnType<typeof setTimeout> | null = null;
let activeModal: EditModal | null = null;

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

  if (exceedsEditTimeLimit(currentRecord.createdAt, editTimeLimit)) {
    modal.open(initialRecordText);
    modal.setEditable(false);
    modal.setError(`This post is older than your edit time limit of ${formatEditTimeLimit(editTimeLimit!)}.`);
    return;
  }

  modal.open(initialRecordText, undefined, async text => {
    const uploadedMedia = modal.getUploadedMedia();
    const updatedRecord = buildUpdatedPostRecord(currentRecord, text, uploadedMedia);

    // Upload media files if any
    if (uploadedMedia.length > 0) {
      try {
        const uploadPromises = uploadedMedia.map(file =>
          sendMessage({
            type: 'UPLOAD_BLOB',
            data: file,
            repo: info.repo,
          }),
        );

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

    // Create a history record for the old version before modifying the post!
    try {
      await sendMessage({
        type: 'CREATE_RECORD',
        repo: info.repo,
        collection: 'agency.self.skeeditor.postVersion',
        record: {
          $type: 'agency.self.skeeditor.postVersion',
          postUri: `at://${info.repo}/${info.collection}/${info.rkey}`,
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
      record: updatedRecord,
      swapRecord: currentCid,
    });

    if (writeResponse.type === 'PUT_RECORD_ERROR') {
      // If re-authentication is required, show a more helpful message
      if (writeResponse.requiresReauth) {
        modal.setError(
          'Your session has expired or lacks permission. Please click the extension icon to sign in again.',
        );
        // Refresh auth state in case the user signs in again
        await refreshAuthState();
        return;
      }
      // If re-authentication is required, show a more helpful message
      if (writeResponse.requiresReauth) {
        modal.setError(
          'Your session has expired or lacks permission. Please click the extension icon to sign in again.',
        );
        // Refresh auth state in case the user signs in again
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

    modal.markSaved(text);
    updatePostText(postElement, text);
    // Normalize to DID form so cache lookups succeed regardless of whether the
    // post was found via handle-form or DID-form URL.
    const normalizedAtUri = normalizeCacheKey(info.atUri, info.repo);
    // Write to cache immediately — the MO path will keep applying the cached
    // text on React re-renders. No setTimeout hack needed.
    setCached(normalizedAtUri, text, initialRecordText);
    recentRecordsCache.set(normalizedAtUri, { record: updatedRecord, cid: writeResponse.cid, savedAt: Date.now() });
    modal.setSuccess('Edit saved.');
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

const scanForPosts = (): void => {
  // Always re-apply persisted text edits — React may have re-rendered since last time.
  applyEditedPostsFromCache();

  console.log(`${APP_NAME}: scanning for posts, currentDid=${currentDid}, currentHandle=${currentHandle}`);

  // Trigger 2: detect "Edited" badges in the DOM and fetch from Slingshot.
  // This runs async — the MO path will apply the results once they land in cache.
  void fetchEditedPostsInView();

  // Fallback trigger: own posts should still resolve even when this surface
  // does not render the Edited badge.
  void fetchOwnPostsInView();

  // Trigger 1: on permalink pages, always fetch the thread root.
  void fetchPermalinkPost();

  // No authenticated DID → don't inject any edit buttons.
  if (currentDid === null) {
    console.log(`${APP_NAME}: no auth session, skipping edit button injection`);
    debugLog('scan-no-auth');
    return;
  }

  let visiblePosts = 0;
  let ownPosts = 0;

  for (const postInfo of findPosts(document)) {
    visiblePosts += 1;
    if (!isElementOwnPost(postInfo.element, postInfo.repo)) {
      continue;
    }
    ownPosts += 1;

    injectEditButton(postInfo.element);
  }

  if (visiblePosts === 0) {
    console.warn(`${APP_NAME}: no post containers detected on page`, {
      pathname: location.pathname,
      currentDid,
      currentHandle,
    });
  }

  debugLog('scan-summary', { currentDid, currentHandle, visiblePosts, ownPosts });
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

const ensureEditedLabelListener = (): void => {
  if (editedLabelListenerAttached) return;
  editedLabelListenerAttached = true;

  // Use capture phase so we fire before Bluesky's own React synthetic handlers.
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
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
    },
    true,
  );
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
    // Re-apply cached text immediately so React re-renders don't produce a visible flicker.
    applyEditedPostsFromCache();
    // Inject original text into Bluesky's "Edited" moderation dialog if one just appeared.
    injectOriginalTextIntoDialog();
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
      debugLog('start-ready', { pathname: location.pathname, search: location.search });
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
      debugLog('start-fallback-anonymous', {
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
};

// Auto-execute when the module is loaded directly (tests and non-WXT environments).
// The WXT entrypoint calls start() explicitly via main(); the hasStarted guard
// prevents double-initialisation.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
