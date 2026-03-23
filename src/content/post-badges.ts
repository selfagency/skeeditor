const EDITED_BADGE_ATTRIBUTE = 'data-skeeditor-edited-badge';

export function markPostAsEdited(postElement: HTMLElement): void {
  if (postElement.querySelector(`[${EDITED_BADGE_ATTRIBUTE}]`)) {
    return;
  }

  const badge = document.createElement('span');
  badge.textContent = 'Edited';
  badge.setAttribute(EDITED_BADGE_ATTRIBUTE, 'true');
  badge.className = 'skeeditor-edited-badge';
  badge.setAttribute('aria-label', 'Edited post');

  const actionContainer = postElement.querySelector<HTMLElement>('[data-testid="postButtonInline"]');
  if (actionContainer) {
    actionContainer.appendChild(badge);
  } else {
    postElement.appendChild(badge);
  }
}
