import globalStyles from '../shadow-styles.css?inline';
import { normalizeMediaFiles } from './post-editor';
import { graphemeLength } from '../shared/utils/text';
import { createStyleElement, createSvgNode } from '../shared/utils/dom';
import './spinner';

const EDIT_MODAL_STYLES = `
    :host {
      display: flex;
      flex-direction: column;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: var(--color-surface-overlay, rgba(0, 0, 0, 0.5));
    }
    ${globalStyles}
    .char-count {
      color: var(--color-text-secondary);
    }
    .char-count.error {
      color: var(--color-error);
    }
    .status-message.error {
      background: var(--color-error-bg);
      color: var(--color-error-text);
    }
    .status-message.success {
      background: var(--color-success-bg);
      color: var(--color-success-text);
    }
`;

function createCloseIcon(): SVGSVGElement {
  const icon = createSvgNode('svg', {
    viewBox: '0 0 24 24',
    class: 'size-5 fill-current',
    'aria-hidden': 'true',
  });
  icon.appendChild(
    createSvgNode('path', {
      d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    }),
  );
  return icon;
}
// Bluesky's post limit is 300 graphemes (user-perceived characters)
const MAX_POST_LENGTH = 300;

export class EditModal {
  public readonly element: HTMLElement;
  private textarea: HTMLTextAreaElement | null = null;
  private charCount: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private statusMessage: HTMLElement | null = null;
  private uploadButton: HTMLButtonElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private mediaPreview: HTMLElement | null = null;
  private loadingState: HTMLElement | null = null;
  private uploadedMedia: File[] = [];
  private objectUrls: Map<File, string> = new Map();
  private originalText = '';
  private currentText = '';
  private maxLength = MAX_POST_LENGTH;
  private onCancel: (() => void) | undefined = undefined;
  private onSave: ((text: string) => void | Promise<void>) | undefined = undefined;
  private previouslyFocused: Element | null = null;
  private isOpen = false;
  private editingEnabled = true;
  private isLoading = false;
  private handleInputBound = this.handleInput.bind(this);
  private handleSaveBound = this.handleSave.bind(this);
  private closeBound = this.close.bind(this);
  private handleBackgroundClickBound = this.handleBackgroundClick.bind(this);
  private handleKeydownBound = this.handleKeydown.bind(this);
  private handleUploadBound = this.handleUpload.bind(this);

  public constructor() {
    this.element = document.createElement('edit-modal');
    this.element.attachShadow({ mode: 'open' });
    this.initialize();
  }

  private initialize(): void {
    if (this.textarea) return;
    const shadow = this.element.shadowRoot!;

    const container = document.createElement('div');
    container.className = 'edit-modal-container';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', 'edit-modal-title');

    const header = document.createElement('div');
    header.className = 'edit-modal-header';
    const title = document.createElement('span');
    title.className = 'edit-modal-title';
    title.id = 'edit-modal-title';
    title.textContent = 'Edit Post';
    const closeButton = document.createElement('button');
    closeButton.className = 'edit-modal-close close-button';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.appendChild(createCloseIcon());
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'edit-modal-body';
    const loadingState = document.createElement('div');
    loadingState.className = 'loading-state hidden';
    loadingState.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('skeeditor-spinner');
    spinner.setAttribute('label', 'Loading latest post…');
    loadingState.appendChild(spinner);

    const textareaWrapper = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-modal-textarea';
    textarea.setAttribute('aria-label', 'Edit post content');
    textareaWrapper.appendChild(textarea);

    const charCount = document.createElement('div');
    charCount.className = 'edit-modal-char-count char-count';

    const mediaUpload = document.createElement('div');
    mediaUpload.className = 'media-upload';
    mediaUpload.style.display = 'flex';
    mediaUpload.style.flexDirection = 'column';
    mediaUpload.style.gap = '0.5rem';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/mp4';
    fileInput.multiple = true;
    fileInput.className = 'hidden';
    const uploadButton = document.createElement('button');
    uploadButton.className = 'upload-button';
    uploadButton.type = 'button';
    uploadButton.textContent = 'Add Media';
    uploadButton.style.borderRadius = '0.375rem';
    uploadButton.style.background = 'var(--color-secondary-bg)';
    uploadButton.style.padding = '0.375rem 0.625rem';
    uploadButton.style.fontSize = '0.875rem';
    uploadButton.style.fontWeight = '600';
    uploadButton.style.color = 'var(--color-secondary-text)';
    uploadButton.style.border = '1px solid var(--color-secondary-border)';
    uploadButton.style.cursor = 'pointer';
    const mediaPreview = document.createElement('div');
    mediaPreview.className = 'media-preview';
    mediaPreview.style.display = 'flex';
    mediaPreview.style.flexWrap = 'wrap';
    mediaPreview.style.gap = '0.5rem';
    mediaUpload.append(fileInput, uploadButton, mediaPreview);

    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message hidden';
    statusMessage.style.borderRadius = '0.375rem';
    statusMessage.style.padding = '0.5rem 0.75rem';
    statusMessage.style.fontSize = '0.875rem';
    statusMessage.setAttribute('aria-live', 'polite');

    body.append(loadingState, textareaWrapper, charCount, mediaUpload, statusMessage);

    const footer = document.createElement('div');
    footer.className = 'edit-modal-footer';
    const cancelButton = document.createElement('button');
    cancelButton.className = 'edit-modal-btn edit-modal-btn-cancel cancel-button';
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    const saveButton = document.createElement('button');
    saveButton.className = 'edit-modal-btn edit-modal-btn-save save-button';
    saveButton.type = 'button';
    saveButton.disabled = true;
    saveButton.textContent = 'Save';
    footer.append(cancelButton, saveButton);

    container.append(header, body, footer);
    shadow.replaceChildren(createStyleElement(EDIT_MODAL_STYLES), container);

    this.element.style.display = 'none';
    this.textarea = textarea;
    this.charCount = charCount;
    this.saveButton = saveButton;
    this.uploadButton = uploadButton;
    this.fileInput = fileInput;
    this.mediaPreview = mediaPreview;
    this.statusMessage = statusMessage;
    this.loadingState = loadingState;

    if (this.textarea) {
      this.textarea.addEventListener('input', this.handleInputBound);
    }
    if (closeButton) {
      closeButton.addEventListener('click', this.closeBound);
    }
    if (cancelButton) {
      cancelButton.addEventListener('click', this.closeBound);
    }

    if (this.saveButton) {
      this.saveButton.addEventListener('click', this.handleSaveBound);
    }

    if (this.uploadButton) {
      this.uploadButton.addEventListener('click', this.handleUploadBound);
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', this.handleUploadBound);
    }

    // Stop all keyboard events from escaping the modal into the host page.
    // Bluesky (and other SPAs) attach hotkey listeners at the document level;
    // without this, typing in the textarea triggers those shortcuts (e.g. 'n'
    // opens a new-post dialog). Events are still handled by our own handler
    // before propagation is stopped.
    this.element.addEventListener('keydown', this.handleKeydownBound);
  }

  public open(text: string, onCancel?: () => void, onSave?: (text: string) => void | Promise<void>): void {
    this.initialize();
    this.originalText = text;
    this.currentText = text;
    this.onCancel = onCancel ?? undefined;
    this.onSave = onSave ?? undefined;
    this.previouslyFocused = document.activeElement;

    if (!this.element.isConnected) {
      document.body.appendChild(this.element);
    }

    if (this.textarea) {
      this.textarea.value = text;
      this.setEditable(true);
      this.setLoading(false);
      this.updateCharCount();
      this.updateSaveButtonState();
      this.textarea.focus();
    }

    this.hideStatusMessage();

    // Remove before adding to prevent duplicate handlers on repeated open() calls
    this.element.removeEventListener('click', this.handleBackgroundClickBound);
    this.element.addEventListener('click', this.handleBackgroundClickBound);

    this.element.style.display = 'flex';
    this.isOpen = true;
  }

  public close(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.uploadedMedia = [];

    this.element.style.display = 'none';
    if (this.element.isConnected) {
      document.body.removeChild(this.element);
    }
    this.element.removeEventListener('click', this.handleBackgroundClickBound);
    this.isOpen = false;

    if (this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;

    this.onCancel?.();
  }

  public setError(message: string): void {
    this.showStatusMessage(message, 'error');
  }

  public setSuccess(message: string): void {
    this.showStatusMessage(message, 'success');
  }

  public setEditable(editable: boolean): void {
    this.editingEnabled = editable;

    if (this.textarea) {
      this.textarea.disabled = !editable;
    }

    if (this.uploadButton) {
      this.uploadButton.disabled = !editable;
    }

    if (this.fileInput) {
      this.fileInput.disabled = !editable;
    }

    this.updateSaveButtonState();
  }

  public setLoading(loading: boolean, message = 'Loading latest post…'): void {
    this.isLoading = loading;

    const spinner = this.loadingState?.querySelector('skeeditor-spinner');
    if (spinner) {
      spinner.setAttribute('label', message);
    }

    this.loadingState?.classList.toggle('hidden', !loading);

    if (this.textarea?.parentElement) {
      this.textarea.parentElement.classList.toggle('hidden', loading);
    }
    this.charCount?.classList.toggle('hidden', loading);
    this.uploadButton?.parentElement?.classList.toggle('hidden', loading);

    if (loading) {
      this.setEditable(false);
    } else {
      this.setEditable(true);
    }
  }

  public setText(text: string): void {
    this.originalText = text;
    this.currentText = text;
    if (this.textarea) {
      this.textarea.value = text;
    }
    this.updateCharCount();
    this.updateSaveButtonState();
  }

  public markSaved(text: string): void {
    this.originalText = text;
    this.currentText = text;

    if (this.textarea) {
      this.textarea.value = text;
    }

    this.updateCharCount();
    this.updateSaveButtonState();
  }

  private handleInput(): void {
    if (this.textarea) {
      this.currentText = this.textarea.value;
      this.updateCharCount();
      this.updateSaveButtonState();
      this.hideStatusMessage();
    }
  }

  private updateCharCount(): void {
    if (!this.charCount || !this.textarea) return;

    const length = graphemeLength(this.currentText);
    const remaining = this.maxLength - length;
    const isError = remaining < 0;

    this.charCount.textContent = `${length} / ${this.maxLength}`;
    if (isError) {
      this.charCount.classList.add('error');
      this.textarea.setCustomValidity('Post exceeds maximum length');
    } else {
      this.charCount.classList.remove('error');
      this.textarea.setCustomValidity('');
    }
  }

  private updateSaveButtonState(): void {
    if (this.saveButton && this.textarea) {
      if (!this.editingEnabled || this.isLoading) {
        this.saveButton.disabled = true;
        return;
      }

      const textChanged = this.textarea.value !== this.originalText;
      const hasMedia = this.uploadedMedia.length > 0;
      this.saveButton.disabled = !textChanged && !hasMedia;
    }
  }

  private showStatusMessage(message: string, type: 'error' | 'success'): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.classList.remove('hidden');
      if (type === 'error') {
        this.statusMessage.classList.add('error');
        this.statusMessage.classList.remove('success');
      } else {
        this.statusMessage.classList.add('success');
        this.statusMessage.classList.remove('error');
      }
    }
  }

  private hideStatusMessage(): void {
    if (this.statusMessage) {
      this.statusMessage.classList.add('hidden');
    }
  }

  private handleBackgroundClick(event: MouseEvent): void {
    // With Shadow DOM, event.target is retargeted to the host for all shadow-internal
    // events. Use composedPath() to get the actual target before retargeting.
    const path = event.composedPath();
    if (path.length > 0 && path[0] === this.element) {
      this.close();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    // Always stop propagation so host-page hotkeys (e.g. Bluesky's 'n' for new
    // post) are never triggered while the user is typing inside the modal.
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.close();
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      this.handleSave();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const shadow = this.element.shadowRoot;
    if (!shadow) return;

    const focusableEls = shadow.querySelectorAll<HTMLElement>('textarea, button:not([disabled])');
    if (focusableEls.length === 0) return;

    const first = focusableEls[0]!;
    const last = focusableEls[focusableEls.length - 1]!;
    const active = shadow.activeElement;

    if (event.shiftKey) {
      if (active === first || !active) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !active) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private handleSave(): void {
    if (this.textarea && !this.textarea.value) {
      this.setError('Post cannot be empty');
      return;
    }

    if (this.textarea && graphemeLength(this.textarea.value) > this.maxLength) {
      this.setError(`Post exceeds maximum length of ${this.maxLength} characters`);
      return;
    }

    const saveResult = this.onSave?.(this.textarea!.value);
    if (saveResult !== undefined) {
      Promise.resolve(saveResult).catch((error: unknown) => {
        console.error('Error while saving post from EditModal:', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'An unexpected error occurred while saving the post.';
        this.setError(message);
      });
    }
  }

  private handleUpload(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLButtonElement;

    if (target.tagName === 'BUTTON' && this.fileInput) {
      // Button click - trigger file input
      this.fileInput.click();
      return;
    }

    if (target.tagName === 'INPUT') {
      const inputTarget = target as HTMLInputElement;
      if (inputTarget.files) {
        // File input change - handle selected files
        const files = Array.from(inputTarget.files) as File[];
        const nextMedia = [...this.uploadedMedia, ...files];
        try {
          this.uploadedMedia = normalizeMediaFiles(nextMedia);
          this.hideStatusMessage();
          this.updateMediaPreview();
          this.updateSaveButtonState();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid media selection';
          this.setError(message);
        }
        inputTarget.value = ''; // Reset input to allow selecting same file again
      }
    }
  }

  private updateMediaPreview(): void {
    if (!this.mediaPreview) return;

    this.mediaPreview.innerHTML = '';

    this.uploadedMedia.forEach((file, index) => {
      const mediaItem = document.createElement('div');
      mediaItem.className = 'relative size-20 overflow-hidden rounded-md';

      const mediaElement = file.type.startsWith('image/')
        ? this.createImageElement(file)
        : this.createVideoElement(file);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className =
        'absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full border-none bg-black/70 p-0 text-xs text-white';
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => this.removeMedia(index));

      mediaItem.appendChild(mediaElement);
      mediaItem.appendChild(removeButton);
      this.mediaPreview?.appendChild(mediaItem);
    });
  }

  private createImageElement(file: File): HTMLImageElement {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    this.objectUrls.set(file, url);
    img.src = url;
    img.alt = file.name;
    img.className = 'size-full object-cover';
    return img;
  }

  private createVideoElement(file: File): HTMLVideoElement {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    this.objectUrls.set(file, url);
    video.src = url;
    video.controls = true;
    video.muted = true;
    video.className = 'size-full object-cover';
    return video;
  }

  private removeMedia(index: number): void {
    const file = this.uploadedMedia[index];
    if (file) {
      const url = this.objectUrls.get(file);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(file);
      }
    }
    this.uploadedMedia.splice(index, 1);
    this.updateMediaPreview();
    this.updateSaveButtonState();
  }

  public getUploadedMedia(): File[] {
    return this.uploadedMedia;
  }

  public clearMedia(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.uploadedMedia = [];
    if (this.mediaPreview) {
      this.mediaPreview.innerHTML = '';
    }
  }
}
