import globalStyles from '../shadow-styles.css?inline';
import { sessionStore } from '../shared/auth/session-store';
import { sendMessage } from '../shared/messages';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

/**
 * `<auth-popup>` Web Component — renders login/logout UI inside the extension
 * popup. Reads session state from `browser.storage.local` directly and delegates
 * auth-flow triggers to the background service worker via `browser.runtime.sendMessage`.
 */
class AuthPopup extends HTMLElement {
  private readonly shadow: ShadowRoot;
  private state: PopupState = 'loading';
  private did: string | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    void this.checkAuth();
  }

  private async checkAuth(): Promise<void> {
    const status = await sessionStore.getAuthStatus();

    if (status !== null && status.expiresAt > Date.now()) {
      this.state = 'authenticated';
      this.did = status.did;
    } else {
      this.state = 'unauthenticated';
      this.did = null;
    }

    this.render();
  }

  private render(): void {
    this.shadow.innerHTML = this.template();
    this.attachHandlers();
  }

  private template(): string {
    const style = `<style>${globalStyles}</style>`;

    switch (this.state) {
      case 'loading':
        return `
          ${style}
          <div class="flex items-center justify-center p-6">
            <span class="loading text-sm text-gray-500 dark:text-gray-400">Checking authentication\u2026</span>
          </div>`;

      case 'unauthenticated':
        return `
          ${style}
          <div class="space-y-4 p-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">Sign in with your Bluesky account to edit posts.</p>
            <div>
              <label for="pds-url" class="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">PDS URL</label>
              <div class="mt-2">
                <input type="url" id="pds-url" value="https://bsky.social" placeholder="https://bsky.social"
                  class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
              </div>
            </div>
            <button id="sign-in" type="button"
              class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
              Sign in with Bluesky
            </button>
          </div>`;

      case 'authenticated':
        return `
          ${style}
          <div class="space-y-3 p-4">
            <p class="break-all font-mono text-xs text-gray-600 dark:text-gray-400">${this.escapeHTML(this.did ?? '')}</p>
            <button id="reauthorize" type="button"
              class="flex w-full justify-center rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20">
              Reauthorize
            </button>
            <button id="sign-out" type="button"
              class="flex w-full justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400 dark:focus-visible:outline-red-500">
              Sign out
            </button>
          </div>`;
    }
  }

  private attachHandlers(): void {
    this.shadow.getElementById('sign-in')?.addEventListener('click', () => {
      const pdsUrlInput = this.shadow.getElementById('pds-url') as HTMLInputElement | null;
      const pdsUrl = pdsUrlInput?.value?.trim() || 'https://bsky.social';
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
    });

    this.shadow.getElementById('sign-out')?.addEventListener('click', () => {
      void sendMessage({ type: 'AUTH_SIGN_OUT' });
      this.state = 'unauthenticated';
      this.did = null;
      this.render();
    });

    this.shadow.getElementById('reauthorize')?.addEventListener('click', () => {
      const pdsUrlInput = this.shadow.getElementById('pds-url') as HTMLInputElement | null;
      const pdsUrl = pdsUrlInput?.value?.trim() || 'https://bsky.social';
      void sendMessage({ type: 'AUTH_REAUTHORIZE', pdsUrl });
    });
  }

  /** Prevent XSS when interpolating user-controlled data (e.g. DIDs) into HTML */
  private escapeHTML(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (!customElements.get('auth-popup')) {
  customElements.define('auth-popup', AuthPopup);
}
