import { browser, type Browser } from 'wxt/browser';
import { APP_NAME } from '../shared/constants';
import type { AuthListAccountsAccount, PutRecordConflictResponse, PutRecordResponse } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { EditModal } from './edit-modal';
import { extractPostInfo, extractPostText, findPosts, updatePostText } from './post-detector';
import { buildUpdatedPostRecord, type EditablePostRecord } from './post-editor';
import './styles.css';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';
const ACTION_AREA_WAIT_TIMEOUT = 3000;

// ── Persistent edit cache ─────────────────────────────────────────────────────

const EDITED_POSTS_KEY = 'editedPosts';
const EDITED_POST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface EditedPostEntry {
  text: string;
  editedAt: number;
}

let editedPostsCache = new Map<string, EditedPostEntry>();

async function loadEditedPostsCache(): Promise<void> {
  try {
    const stored = await browser.storage.local.get(EDITED_POSTS_KEY);
    const raw = (stored[EDITED_POSTS_KEY] ?? {}) as Record<string, EditedPostEntry>;
    const now = Date.now();
    editedPostsCache = new Map(Object.entries(raw).filter(([, v]) => now - v.editedAt < EDITED_POST_TTL_MS));
  } catch (err) {
    console.warn(`${APP_NAME}: could not load edit cache`, err);
  }
}

async function saveEditedPost(atUri: string, text: string): Promise<void> {
  const entry: EditedPostEntry = { text, editedAt: Date.now() };
  editedPostsCache.set(atUri, entry);
  try {
    const stored = await browser.storage.local.get(EDITED_POSTS_KEY);
    const raw = (stored[EDITED_POSTS_KEY] ?? {}) as Record<string, EditedPostEntry>;
    const now = Date.now();
    const pruned: Record<string, EditedPostEntry> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (now - v.editedAt < EDITED_POST_TTL_MS) pruned[k] = v;
    }
    pruned[atUri] = entry;
    await browser.storage.local.set({ [EDITED_POSTS_KEY]: pruned });
  } catch (err) {
    console.warn(`${APP_NAME}: could not persist edited post`, err);
  }
}

function applyEditedPostsFromCache(): void {
  if (editedPostsCache.size === 0) return;
  const now = Date.now();
  for (const postInfo of findPosts(document)) {
    const entry = editedPostsCache.get(postInfo.atUri);
    if (entry !== undefined && now - entry.editedAt < EDITED_POST_TTL_MS) {
      updatePostText(postInfo.element, entry.text);
    }
  }
}
const ACTION_AREA_SELECTORS = [
  '[data-testid="postButtonInline"]',
  'button[aria-label="Open post options menu"]',
  'button[data-testid="postDropdownBtn"]',
];

// Debug: Log when content script loads
console.log(`${APP_NAME}: content script loaded on ${document.location.href}`);

let mutationObserver: MutationObserver | null = null;
let currentDid: string | null = null;
let currentHandle: string | null = null;
let domContentLoadedHandler: (() => void) | null = null;
let storageChangeHandler: ((changes: Record<string, Browser.storage.StorageChange>) => void) | null = null;
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
    console.log(`${APP_NAME}: currentDid=${currentDid}, currentHandle=${currentHandle}`);
  } catch (err) {
    console.error(`${APP_NAME}: failed to load auth state`, err);
    currentDid = null;
    currentHandle = null;
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
    void checkProfileSwitch(location.href);
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>): void {
    originalReplaceState!.apply(history, args);
    void checkProfileSwitch(location.href);
  };

  navigationHandler = (): void => {
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

  const currentRecord = recordResponse.value as EditablePostRecord;
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

    const writeResponse = await sendMessage({
      type: 'PUT_RECORD',
      repo: info.repo,
      collection: info.collection,
      rkey: info.rkey,
      record: updatedRecord,
      swapRecord: recordResponse.cid,
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
    void saveEditedPost(info.atUri, text);
    modal.setSuccess('Edit saved.');
    console.info(`${APP_NAME}: edit saved`, { atUri: info.atUri, uri: writeResponse.uri, cid: writeResponse.cid });
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
  // No authenticated DID → don't inject any edit buttons.
  if (currentDid === null) {
    console.log(`${APP_NAME}: no auth session, skipping edit button injection`);
    return;
  }

  for (const postInfo of findPosts(document)) {
    console.log(
      `${APP_NAME}: found post with repo=${postInfo.repo}, comparing with currentDid=${currentDid}, currentHandle=${currentHandle}`,
    );
    if (postInfo.repo !== currentDid && postInfo.repo !== currentHandle) {
      console.log(`${APP_NAME}: skipping post, repo does not match currentDid or currentHandle`);
      continue;
    }

    console.log(`${APP_NAME}: injecting edit button for post with repo=${postInfo.repo}`);
    injectEditButton(postInfo.element);
  }
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

const ensureObserver = (): void => {
  if (mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver(() => {
    scheduleScanForPosts();
  });

  const target = findObserverTarget();
  mutationObserver.observe(target, { childList: true, subtree: true });
};

let hasStarted = false;

export const start = (): void => {
  if (hasStarted) return;
  hasStarted = true;

  ensureObserver();
  ensureStorageListener();
  ensureNavigationListeners();

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
    .then(() => Promise.all([refreshAuthState(), loadKnownAccounts(), loadEditedPostsCache()]))
    .then(() => {
      scanForPosts();
      document.documentElement.setAttribute('data-skeeditor-initialized', 'true');
      console.info(`${APP_NAME}: content script loaded`);
    })
    .catch(error => {
      console.error(`${APP_NAME}: failed to load auth state`, error);
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
