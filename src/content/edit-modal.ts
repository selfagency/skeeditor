import { graphemeLength } from '../shared/utils/text';

const EDIT_MODAL_TEMPLATE = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
    }

    .modal {
      display: flex;
      flex-direction: column;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(90vw, 600px);
      max-width: 600px;
      max-height: 80vh;
      background: var(--bsky-color-white, #ffffff);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--bsky-color-border, #e5e5e5);
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: var(--bsky-color-text, #1d1d1d);
    }

    .close-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .close-button:hover {
      background: var(--bsky-color-hover, #f5f5f5);
    }

    .close-button svg {
      width: 20px;
      height: 20px;
      fill: var(--bsky-color-text, #1d1d1d);
    }

    .content {
      display: flex;
      flex-direction: column;
      padding: 20px;
      overflow-y: auto;
    }

    .textarea-container {
      position: relative;
      flex: 1;
      min-height: 150px;
    }

    textarea {
      width: 100%;
      min-height: 150px;
      padding: 12px;
      border: 1px solid var(--bsky-color-border, #e5e5e5);
      border-radius: 8px;
      font-size: 15px;
      line-height: 1.5;
      resize: vertical;
      background: var(--bsky-color-white, #ffffff);
      color: var(--bsky-color-text, #1d1d1d);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    textarea:focus {
      outline: none;
      border-color: var(--bsky-color-primary, #1185fb);
      box-shadow: 0 0 0 2px rgba(17, 133, 251, 0.2);
    }

    .char-count {
      display: flex;
      justify-content: flex-end;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--bsky-color-text-light, #666666);
    }

    .char-count.error {
      color: var(--bsky-color-error, #ff3b30);
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid var(--bsky-color-border, #e5e5e5);
    }

    button {
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    button:hover {
      opacity: 0.9;
    }

    button:active {
      opacity: 0.8;
    }

    .cancel-button {
      background: var(--bsky-color-white, #ffffff);
      border: 1px solid var(--bsky-color-border, #e5e5e5);
      color: var(--bsky-color-text, #1d1d1d);
    }

    .save-button {
      background: var(--bsky-color-primary, #1185fb);
      border: 1px solid var(--bsky-color-primary, #1185fb);
      color: var(--bsky-color-white, #ffffff);
    }

    .save-button:disabled {
      background: var(--bsky-color-disabled, #e5e5e5);
      border-color: var(--bsky-color-disabled, #e5e5e5);
      color: var(--bsky-color-text-disabled, #999999);
      cursor: not-allowed;
    }

    .status-message {
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .media-upload {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .upload-button {
      padding: 8px 16px;
      background: var(--bsky-color-button-secondary-bg, #f0f0f0);
      border: 1px solid var(--bsky-color-border, #e5e5e5);
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .media-preview {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .media-item {
      position: relative;
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
    }

    .media-item img, .media-item video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .remove-media {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 12px;
    }

    .status-message.error {
      background: var(--bsky-color-error-bg, #ffe5e5);
      color: var(--bsky-color-error, #ff3b30);
    }

    .status-message.success {
      background: var(--bsky-color-success-bg, #e5ffe5);
      color: var(--bsky-color-success, #51d051);
    }
  </style>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
    <div class="header">
      <span class="title" id="edit-modal-title">Edit Post</span>
      <button class="close-button" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div class="content">
      <div class="textarea-container">
        <textarea aria-label="Edit post content"></textarea>
      </div>
      <div class="char-count"></div>
      <div class="media-upload">
        <input type="file" accept="image/*,video/mp4" multiple style="display: none;">
        <button class="upload-button" type="button">Add Media</button>
        <div class="media-preview"></div>
      </div>
      <div class="status-message" aria-live="polite" style="display: none;"></div>
    </div>
    <div class="footer">
      <button class="cancel-button" type="button">Cancel</button>
      <button class="save-button" type="button" disabled>Save</button>
    </div>
  </div>
`;

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
  private uploadedMedia: File[] = [];
  private originalText = '';
  private currentText = '';
  private maxLength = MAX_POST_LENGTH;
  private onCancel: (() => void) | undefined = undefined;
  private onSave: ((text: string) => void | Promise<void>) | undefined = undefined;
  private previouslyFocused: Element | null = null;
  private isOpen = false;
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
    shadow.innerHTML = EDIT_MODAL_TEMPLATE;
    this.element.style.display = 'none';
    this.textarea = shadow.querySelector<HTMLTextAreaElement>('textarea');
    this.charCount = shadow.querySelector<HTMLElement>('.char-count');
    this.saveButton = shadow.querySelector<HTMLButtonElement>('.save-button');
    this.uploadButton = shadow.querySelector<HTMLButtonElement>('.upload-button');
    this.fileInput = shadow.querySelector<HTMLInputElement>('input[type="file"]');
    this.mediaPreview = shadow.querySelector<HTMLElement>('.media-preview');
    this.statusMessage = shadow.querySelector<HTMLElement>('.status-message');

    if (this.textarea) {
      this.textarea.addEventListener('input', this.handleInputBound);
    }

    const closeButton = shadow.querySelector<HTMLButtonElement>('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', this.closeBound);
    }

    const cancelButton = shadow.querySelector<HTMLButtonElement>('.cancel-button');
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
      this.updateCharCount();
      this.updateSaveButtonState();
      this.textarea.focus();
    }

    this.hideStatusMessage();

    // Remove before adding to prevent duplicate handlers on repeated open() calls
    this.element.removeEventListener('click', this.handleBackgroundClickBound);
    window.removeEventListener('keydown', this.handleKeydownBound);
    this.element.addEventListener('click', this.handleBackgroundClickBound);
    window.addEventListener('keydown', this.handleKeydownBound);

    this.element.style.display = 'flex';
    this.isOpen = true;
  }

  public close(): void {
    this.element.style.display = 'none';
    if (this.element.isConnected) {
      document.body.removeChild(this.element);
    }
    window.removeEventListener('keydown', this.handleKeydownBound);
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
    this.charCount.className = isError ? 'char-count error' : 'char-count';

    if (isError) {
      this.textarea.setCustomValidity('Post exceeds maximum length');
    } else {
      this.textarea.setCustomValidity('');
    }
  }

  private updateSaveButtonState(): void {
    if (this.saveButton && this.textarea) {
      this.saveButton.disabled = this.textarea.value === this.originalText;
    }
  }

  private showStatusMessage(message: string, type: 'error' | 'success'): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.style.display = 'block';
      this.statusMessage.className = `status-message ${type}`;
    }
  }

  private hideStatusMessage(): void {
    if (this.statusMessage) {
      this.statusMessage.style.display = 'none';
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
        this.uploadedMedia = [...this.uploadedMedia, ...files];
        this.updateMediaPreview();
        inputTarget.value = ''; // Reset input to allow selecting same file again
      }
    }
  }

  private updateMediaPreview(): void {
    if (!this.mediaPreview) return;

    this.mediaPreview.innerHTML = '';

    this.uploadedMedia.forEach((file, index) => {
      const mediaItem = document.createElement('div');
      mediaItem.className = 'media-item';

      const mediaElement = file.type.startsWith('image/')
        ? this.createImageElement(file)
        : this.createVideoElement(file);

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-media';
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => this.removeMedia(index));

      mediaItem.appendChild(mediaElement);
      mediaItem.appendChild(removeButton);
      this.mediaPreview?.appendChild(mediaItem);
    });
  }

  private createImageElement(file: File): HTMLImageElement {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    return img;
  }

  private createVideoElement(file: File): HTMLVideoElement {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.muted = true;
    return video;
  }

  private removeMedia(index: number): void {
    this.uploadedMedia.splice(index, 1);
    this.updateMediaPreview();
  }

  public getUploadedMedia(): File[] {
    return this.uploadedMedia;
  }

  public clearMedia(): void {
    this.uploadedMedia = [];
    if (this.mediaPreview) {
      this.mediaPreview.innerHTML = '';
    }
  }
}
