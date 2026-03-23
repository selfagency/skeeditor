import { APP_NAME } from '../shared/constants';
import { sendMessage } from '../shared/messages';
import './styles.css';
import { EditModal } from './edit-modal';
import { markPostAsEdited } from './post-badges';
import { extractPostInfo, extractPostText, findPosts } from './post-detector';
import { buildUpdatedPostRecord, type EditablePostRecord } from './post-editor';
import type { PutRecordWithSwapResult } from '../shared/api/xrpc-client';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';

let mutationObserver: MutationObserver | null = null;
let currentDid: string | null = null;
let domContentLoadedHandler: (() => void) | null = null;

const getOrCreateEditModal = (): EditModal => {
  const existing = document.querySelector<EditModal>('edit-modal[data-skeeditor-modal="true"]');

  if (existing) {
    return existing;
  }

  const modal = document.createElement('edit-modal') as EditModal;
  modal.setAttribute('data-skeeditor-modal', 'true');
  document.body.appendChild(modal);

  return modal;
};

const isPutRecordWithSwapResult = (response: unknown): response is PutRecordWithSwapResult => {
  return typeof response === 'object' && response !== null && 'success' in response;
};

const isPutRecordConflictResult = (
  response: PutRecordWithSwapResult,
): response is Extract<PutRecordWithSwapResult, { success: false }> => {
  return response.success === false;
};

const refreshAuthState = async (): Promise<void> => {
  const status = await sendMessage({ type: 'AUTH_GET_STATUS' });
  currentDid = status.authenticated ? status.did : null;
};

const handleEditClick = async (postElement: HTMLElement): Promise<void> => {
  const info = extractPostInfo(postElement);
  if (!info || currentDid !== info.repo) {
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

  modal.open(initialRecordText, undefined, async text => {
    const updatedRecord = buildUpdatedPostRecord(currentRecord, text);

    const writeResponse = await sendMessage({
      type: 'PUT_RECORD',
      repo: info.repo,
      collection: info.collection,
      rkey: info.rkey,
      record: updatedRecord,
      swapRecord: recordResponse.cid,
    });

    if ('error' in writeResponse) {
      const errorMessage = typeof writeResponse.error === 'string' ? writeResponse.error : writeResponse.error.message;
      modal.setError(errorMessage);
      return;
    }

    if (isPutRecordWithSwapResult(writeResponse)) {
      if (isPutRecordConflictResult(writeResponse)) {
        const conflictResponse = writeResponse as Extract<PutRecordWithSwapResult, { success: false }>;
        const conflictMessage = conflictResponse.conflict
          ? 'This post changed while you were editing. Reload to compare the latest version.'
          : 'This post changed while you were editing. Please reload and try again.';

        modal.setError(conflictMessage);
        return;
      }

      modal.markSaved(text);
      markPostAsEdited(postElement);
      modal.setSuccess('Edit saved.');
      console.info(`${APP_NAME}: edit saved`, { atUri: info.atUri, uri: writeResponse.uri, cid: writeResponse.cid });
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
    handleEditClick(postElement);
  });

  const actionContainer = postElement.querySelector<HTMLElement>('[data-testid="postButtonInline"]');
  if (actionContainer) {
    actionContainer.appendChild(button);
  } else {
    postElement.appendChild(button);
  }

  postElement.setAttribute(POST_MARKER_ATTRIBUTE, 'true');
};

const scanForPosts = (): void => {
  for (const postInfo of findPosts(document)) {
    if (currentDid !== null && postInfo.repo !== currentDid) {
      continue;
    }

    injectEditButton(postInfo.element);
  }
};

const ensureObserver = (): void => {
  if (mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver(() => {
    scanForPosts();
  });

  if (document.body) {
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
};

const start = (): void => {
  ensureObserver();

  void refreshAuthState()
    .then(() => {
      scanForPosts();
      console.info(`${APP_NAME}: content script loaded`);
    })
    .catch(error => {
      console.error(`${APP_NAME}: failed to load auth state`, error);
      scanForPosts();
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
  mutationObserver?.disconnect();
  mutationObserver = null;

  if (domContentLoadedHandler) {
    document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    domContentLoadedHandler = null;
  }

  currentDid = null;
};
