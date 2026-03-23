import { APP_NAME } from '../shared/constants';
import './styles.css';
import { EditModal } from './edit-modal';
import { extractPostInfo, extractPostText, findPosts } from './post-detector';

const POST_MARKER_ATTRIBUTE = 'data-skeeditor-processed';
const EDIT_BUTTON_ATTRIBUTE = 'data-skeeditor-edit-button';

let mutationObserver: MutationObserver | null = null;

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

const handleEditClick = (postElement: HTMLElement): void => {
  const info = extractPostInfo(postElement);
  const modal = getOrCreateEditModal();
  const initialText = extractPostText(postElement);

  modal.open(initialText, undefined, text => {
    console.info(`${APP_NAME}: edit requested`, { atUri: info?.atUri, text });
    modal.setSuccess('Edit captured locally. Background wiring comes next.');
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
  scanForPosts();
  ensureObserver();
  console.info(`${APP_NAME}: content script loaded`);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
