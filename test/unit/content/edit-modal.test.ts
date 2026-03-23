import { describe, expect, it, vi } from 'vitest';

import { EditModal } from '@src/content/edit-modal';

const createModal = (): EditModal => {
  const modal = new EditModal();
  document.body.appendChild(modal);
  modal.connectedCallback();

  return modal;
};

describe('edit-modal', () => {
  it('should render the initial text and keep save disabled until changes are made', () => {
    const modal = createModal();

    modal.open('Hello Bluesky');

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.querySelector('.save-button') as HTMLButtonElement;

    expect(textarea.value).toBe('Hello Bluesky');
    expect(saveButton.disabled).toBe(true);

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(saveButton.disabled).toBe(false);
  });

  it('should update the character count when the text changes', () => {
    const modal = createModal();

    modal.open('Hello Bluesky');

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    const charCount = modal.querySelector('.char-count') as HTMLElement;

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(charCount.textContent).toBe('21 / 300');
  });

  it('should call the save callback when Save is clicked after editing', () => {
    const modal = createModal();
    const onSave = vi.fn();

    modal.open('Hello Bluesky', undefined, onSave);

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.querySelector('.save-button') as HTMLButtonElement;

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton.click();

    expect(onSave).toHaveBeenCalledWith('Hello Bluesky, edited');
  });
});
