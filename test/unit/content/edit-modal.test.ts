import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditModal } from '@src/content/edit-modal';

let activeModal: EditModal | null = null;

const createModal = (): EditModal => {
  const modal = new EditModal();
  document.body.appendChild(modal.element);
  activeModal = modal;
  return modal;
};

describe('edit-modal', () => {
  afterEach(() => {
    activeModal?.close();
    activeModal = null;
    document.body.innerHTML = '';
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

  it('should count graphemes not UTF-16 code units for character count', () => {
    const modal = createModal();

    // 👨‍👩‍👧‍👦 is 1 grapheme but 11 UTF-16 code units
    const emojiText = '👨‍👩‍👧‍👦 Family emoji';
    modal.open(emojiText);

    const charCount = modal.element.shadowRoot!.querySelector('.char-count') as HTMLElement;

    // "👨‍👩‍👧‍👦 Family emoji" = 1 + 1 + 6 + 1 + 5 = 14 graphemes (not 24 UTF-16 code units)
    expect(charCount.textContent).toBe('14 / 300');
  });

  it('should enforce 300 grapheme limit not 300 UTF-16 code unit limit on save', () => {
    const modal = createModal();
    const onSave = vi.fn();

    // Create text that's under 300 graphemes but over 300 UTF-16 code units
    // Each 👨‍👩‍👧‍👦 is 1 grapheme but 11 code units. 28 of them = 28 graphemes, 308 code units
    const emojiText = '👨‍👩‍👧‍👦'.repeat(28);
    modal.open('something else', undefined, onSave);

    const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = modal.element.shadowRoot!.querySelector('.save-button') as HTMLButtonElement;

    textarea.value = emojiText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton.click();

    // 28 graphemes is well under 300, so save should succeed
    expect(onSave).toHaveBeenCalledWith(emojiText);
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

  describe('accessibility', () => {
    it('should have role="dialog" and aria-modal="true" on the modal', () => {
      const modal = createModal();
      modal.open('Hello');

      const dialogEl = modal.element.shadowRoot!.querySelector('.modal') as HTMLElement;

      expect(dialogEl.getAttribute('role')).toBe('dialog');
      expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-labelledby pointing to the title element', () => {
      const modal = createModal();
      modal.open('Hello');

      const dialogEl = modal.element.shadowRoot!.querySelector('.modal') as HTMLElement;
      const titleEl = modal.element.shadowRoot!.querySelector('.title') as HTMLElement;

      expect(titleEl.id).toBeTruthy();
      expect(dialogEl.getAttribute('aria-labelledby')).toBe(titleEl.id);
    });

    it('should have aria-live="polite" on the status message element', () => {
      const modal = createModal();
      modal.open('Hello');

      const statusEl = modal.element.shadowRoot!.querySelector('.status-message') as HTMLElement;

      expect(statusEl.getAttribute('aria-live')).toBe('polite');
    });

    it('should save and restore focus when opening and closing the modal', () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Edit';
      document.body.appendChild(trigger);
      trigger.focus();

      expect(document.activeElement).toBe(trigger);

      const modal = createModal();
      modal.open('Hello');

      modal.close();

      expect(document.activeElement).toBe(trigger);
    });

    it('should trap focus within the modal on Tab', () => {
      const modal = createModal();
      modal.open('Hello');

      const shadow = modal.element.shadowRoot!;
      // Cancel button is the last non-disabled focusable element
      const cancelButton = shadow.querySelector('.cancel-button') as HTMLButtonElement;

      // Focus on cancel (last non-disabled), Tab should wrap to first focusable (close button)
      cancelButton.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      window.dispatchEvent(tabEvent);

      const activeEl = shadow.activeElement;
      const closeButton = shadow.querySelector('.close-button') as HTMLElement;
      expect(activeEl).toBe(closeButton);
    });

    it('should trap focus within the modal on Shift+Tab', () => {
      const modal = createModal();
      modal.open('Hello');

      const shadow = modal.element.shadowRoot!;
      // Close button is the first focusable element in document order
      const closeButton = shadow.querySelector('.close-button') as HTMLButtonElement;

      // Focus on close button (first focusable), Shift+Tab should wrap to cancel (last non-disabled)
      closeButton.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(shiftTabEvent);

      const activeEl = shadow.activeElement;
      const cancelButton = shadow.querySelector('.cancel-button') as HTMLElement;
      expect(activeEl).toBe(cancelButton);
    });

    it('should add aria-label to the textarea', () => {
      const modal = createModal();
      modal.open('Hello');

      const textarea = modal.element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

      expect(textarea.getAttribute('aria-label')).toBe('Edit post content');
    });
  });
});
