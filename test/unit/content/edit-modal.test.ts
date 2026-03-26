import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditModal } from '@src/content/edit-modal';

describe('edit-modal', () => {
  let modal: EditModal;

  const createModal = (): EditModal => {
    modal = new EditModal();
    document.body.appendChild(modal.element);
    return modal;
  };

  afterEach(() => {
    // Remove the window keydown listener registered by initialize() to prevent
    // cross-test interference when a test does not call modal.close() itself.
    if (modal?.element?.isConnected) {
      modal.close();
    }
  });

  it('should render the initial text and keep save disabled until changes are made', () => {
    const modal = createModal();

    modal.open('Hello Bluesky');

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.element.shadowRoot!.querySelector('.save-button') as HTMLButtonElement;

    expect(textarea.value).toBe('Hello Bluesky');
    expect(saveButton.disabled).toBe(true);

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(saveButton.disabled).toBe(false);
  });

  it('should update the character count when the text changes', () => {
    const modal = createModal();

    modal.open('Hello Bluesky');

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const charCount = modal.element.shadowRoot!.querySelector('.char-count') as HTMLElement;

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(charCount.textContent).toBe('21 / 300');
  });

  it('should call the save callback when Save is clicked after editing', () => {
    const modal = createModal();
    const onSave = vi.fn();

    modal.open('Hello Bluesky', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.element.shadowRoot!.querySelector('.save-button') as HTMLButtonElement;

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton.click();

    expect(onSave).toHaveBeenCalledWith('Hello Bluesky, edited');
  });

  it('should surface save callback rejections as an error message', async () => {
    const modal = createModal();
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));

    modal.open('Hello Bluesky', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.element.shadowRoot!.querySelector('.save-button') as HTMLButtonElement;

    textarea.value = 'Hello Bluesky, edited';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton.click();

    await Promise.resolve();

    const statusMessage = modal.element.shadowRoot!.querySelector('.status-message') as HTMLElement;
    expect(statusMessage.textContent).toContain('save failed');
  });

  it('should close the modal when Escape is pressed', () => {
    const modal = createModal();
    const onCancel = vi.fn();

    modal.open('Hello Bluesky', onCancel);

    expect(modal.element.style.display).toBe('flex');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(modal.element.style.display).toBe('none');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should trigger save when Cmd+Enter is pressed', () => {
    const modal = createModal();
    const onSave = vi.fn();

    modal.open('Hello Bluesky', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Edited text';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

    expect(onSave).toHaveBeenCalledWith('Edited text');
  });

  it('should trigger save when Ctrl+Enter is pressed', () => {
    const modal = createModal();
    const onSave = vi.fn();

    modal.open('Hello Bluesky', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Edited text';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

    expect(onSave).toHaveBeenCalledWith('Edited text');
  });

  it('should show error and not save when text exceeds 300 characters', () => {
    const modal = createModal();
    const onSave = vi.fn();

    modal.open('Hello', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.element.shadowRoot!.querySelector('.save-button') as HTMLButtonElement;

    textarea.value = 'a'.repeat(301);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Force-enable save button to test the length validation in handleSave
    saveButton.disabled = false;
    saveButton.click();

    expect(onSave).not.toHaveBeenCalled();

    const statusMessage = modal.element.shadowRoot!.querySelector('.status-message') as HTMLElement;
    expect(statusMessage.textContent).toContain('exceeds maximum length');
  });
});
