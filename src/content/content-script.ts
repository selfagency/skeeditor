import browser from 'webextension-polyfill';
import { APP_NAME } from '../shared/constants';
import type { AuthListAccountsAccount, PutRecordConflictResponse, PutRecordResponse } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { EditModal } from './edit-modal';
import { markPostAsEdited } from './post-badges';
import { extractPostInfo, extractPostText, findPosts } from './post-detector';
import { buildUpdatedPostRecord, type EditablePostRecord } from './post-editor';
import './styles.css';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';

let mutationObserver: MutationObserver | null = null;
let currentDid: string | null = null;
let currentHandle: string | null = null;
let domContentLoadedHandler: (() => void) | null = null;
let storageChangeHandler: ((changes: Record<string, browser.Storage.StorageChange>) => void) | null = null;
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
  const status = await sendMessage({ type: 'AUTH_GET_STATUS' });
  currentDid = status.authenticated ? status.did : null;
  currentHandle = status.authenticated ? (status.handle ?? null) : null;
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
    markPostAsEdited(postElement);
    modal.setSuccess('Edit saved.');
    console.info(`${APP_NAME}: edit saved`, { atUri: info.atUri, uri: writeResponse.uri, cid: writeResponse.cid });
  });
};

const injectEditButton = (postElement: HTMLElement): void => {
  if (postElement.hasAttribute(POST_MARKER_ATTRIBUTE) || postElement.querySelector(`[${EDIT_BUTTON_ATTRIBUTE}]`)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Edit';
  button.setAttribute(EDIT_BUTTON_ATTRIBUTE, 'true');
  button.className = 'skeeditor-edit-button';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    void handleEditClick(postElement).catch(error => {
      console.error(`${APP_NAME}: failed to handle edit click`, error);
    });
  });

  const actionContainer = postElement.querySelector<HTMLElement>('[data-testid="postButtonInline"]');
  const optionsButton = postElement.querySelector<HTMLElement>('button[aria-label="Open post options menu"]');
  const liveActionContainer = optionsButton?.parentElement;
  if (actionContainer) {
    actionContainer.appendChild(button);
  } else if (liveActionContainer) {
    liveActionContainer.insertBefore(button, optionsButton);
  } else {
    postElement.appendChild(button);
  }

  postElement.setAttribute(POST_MARKER_ATTRIBUTE, 'true');
};

const scanForPosts = (): void => {
  // No authenticated DID → don't inject any edit buttons.
  if (currentDid === null) {
    return;
  }

  for (const postInfo of findPosts(document)) {
    if (postInfo.repo !== currentDid && postInfo.repo !== currentHandle) {
      continue;
    }

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

  storageChangeHandler = (changes: Record<string, browser.Storage.StorageChange>) => {
    if (!('session' in changes)) {
      return;
    }
    const { newValue } = changes['session'];
    if (newValue == null) {
      // Session cleared — signed out. Remove edit buttons immediately.
      currentDid = null;
      currentHandle = null;
      dismissActiveModal();
      removeInjectedElements();
    } else {
      // Session updated (new login or token refresh) — re-check auth and re-scan.
      void refreshAuthState()
        .then(() => scheduleScanForPosts())
        .catch(err => console.error(`${APP_NAME}: storage refresh failed`, err));
    }
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

const start = (): void => {
  ensureObserver();
  ensureStorageListener();
  ensureNavigationListeners();

  void Promise.all([refreshAuthState(), loadKnownAccounts()])
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

if (document.readyState === 'loading') {
  domContentLoadedHandler = start;
  document.addEventListener('DOMContentLoaded', domContentLoadedHandler, { once: true });
} else {
  start();
}

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
};
