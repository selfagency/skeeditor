import { describe, expect, it, vi } from 'vitest';

import { EditModal } from '@src/content/edit-modal';

const createModal = (): EditModal => {
  const modal = new EditModal();
  document.body.appendChild(modal.element);
  return modal;
};

describe('edit-modal', () => {
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
});
