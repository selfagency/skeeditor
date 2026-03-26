import globalStyles from '../shadow-styles.css?inline';
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
    ${globalStyles}
  </style>
  <div class="relative m-auto flex w-full max-w-xl flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
    <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
      <span class="text-base font-semibold text-gray-900 dark:text-white" id="edit-modal-title">Edit Post</span>
      <button class="close-button rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 dark:hover:bg-white/10 dark:hover:text-white dark:focus:outline-indigo-500" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" class="size-5 fill-current" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div class="flex flex-col gap-3 overflow-y-auto p-5" style="max-height:60vh">
      <div>
        <textarea aria-label="Edit post content" class="block min-h-36 w-full resize-y rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus:outline-indigo-500"></textarea>
      </div>
      <div class="char-count flex justify-end text-xs text-gray-500 dark:text-gray-400"></div>
      <div class="media-upload flex flex-col gap-2">
        <input type="file" accept="image/*,video/mp4" multiple class="hidden">
        <button class="upload-button rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20" type="button">Add Media</button>
        <div class="media-preview flex flex-wrap gap-2"></div>
      </div>
      <div class="status-message hidden rounded-md px-3 py-2 text-sm" aria-live="polite"></div>
    </div>
    <div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-white/10">
      <button class="cancel-button rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20" type="button">Cancel</button>
      <button class="save-button rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500 dark:disabled:bg-white/10 dark:disabled:text-white/30" type="button" disabled>Save</button>
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
  private objectUrls: Map<File, string> = new Map();
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
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.uploadedMedia = [];

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
    if (isError) {
      this.charCount.classList.remove('text-gray-500', 'dark:text-gray-400');
      this.charCount.classList.add('text-red-500', 'dark:text-red-400');
      this.textarea.setCustomValidity('Post exceeds maximum length');
    } else {
      this.charCount.classList.remove('text-red-500', 'dark:text-red-400');
      this.charCount.classList.add('text-gray-500', 'dark:text-gray-400');
      this.textarea.setCustomValidity('');
    }
  }

  private updateSaveButtonState(): void {
    if (this.saveButton && this.textarea) {
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
        this.statusMessage.classList.add(
          'error',
          'bg-red-50',
          'text-red-700',
          'dark:bg-red-400/10',
          'dark:text-red-400',
        );
        this.statusMessage.classList.remove(
          'success',
          'bg-green-50',
          'text-green-700',
          'dark:bg-green-400/10',
          'dark:text-green-400',
        );
      } else {
        this.statusMessage.classList.add(
          'success',
          'bg-green-50',
          'text-green-700',
          'dark:bg-green-400/10',
          'dark:text-green-400',
        );
        this.statusMessage.classList.remove(
          'error',
          'bg-red-50',
          'text-red-700',
          'dark:bg-red-400/10',
          'dark:text-red-400',
        );
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
        this.updateSaveButtonState();
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
