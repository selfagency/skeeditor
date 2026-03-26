import globalStyles from '../shadow-styles.css?inline';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

/**
 * `<auth-popup>` Web Component — renders login/logout UI inside the extension
 * popup. Loads account list from the background service worker via
 * `browser.runtime.sendMessage` and delegates all auth-flow actions via the
 * same channel.
 */
class AuthPopup extends HTMLElement {
  private readonly shadow: ShadowRoot;
  private state: PopupState = 'loading';
  private accounts: AuthListAccountsAccount[] = [];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    void this.loadAccounts();
  }

  private async loadAccounts(): Promise<void> {
    const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
    this.accounts = response.accounts;
    this.state = this.accounts.length > 0 ? 'authenticated' : 'unauthenticated';
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

      case 'authenticated': {
        const accountCards = this.accounts
          .map(account => {
            const label = account.handle
              ? `<span class="text-sm font-medium text-gray-900 dark:text-gray-100">${this.escapeHTML(account.handle)}</span>`
              : `<span class="break-all font-mono text-xs text-gray-600 dark:text-gray-400">${this.escapeHTML(account.did)}</span>`;
            const activeIndicator = account.isActive
              ? '<span class="ml-1 text-xs text-indigo-600 dark:text-indigo-400">(active)</span>'
              : '';
            const switchBtn = account.isActive
              ? ''
              : `<button type="button" class="account-switch rounded px-2 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" data-did="${this.escapeHTML(account.did)}">Switch</button>`;
            const reauthorizeBtn = account.isActive
              ? `<button id="reauthorize" type="button" class="rounded px-2 py-1 text-xs bg-white text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2">Reauthorize</button>`
              : '';
            return `
            <div class="account-card rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0 flex-1">${label}${activeIndicator}</div>
                <div class="flex shrink-0 items-center gap-1">
                  ${switchBtn}
                  ${reauthorizeBtn}
                  <button type="button" class="account-sign-out rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" data-did="${this.escapeHTML(account.did)}">Sign out</button>
                </div>
              </div>
            </div>`;
          })
          .join('');

        return `
          ${style}
          <div class="space-y-3 p-4">
            ${accountCards}
            <button id="add-account" type="button"
              class="flex w-full justify-center rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20">
              Add another account
            </button>
          </div>`;
      }
    }
  }

  private attachHandlers(): void {
    this.shadow.getElementById('sign-in')?.addEventListener('click', () => {
      const pdsUrlInput = this.shadow.getElementById('pds-url') as HTMLInputElement | null;
      const pdsUrl = pdsUrlInput?.value?.trim() || 'https://bsky.social';
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
    });

    this.shadow.getElementById('add-account')?.addEventListener('click', () => {
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl: 'https://bsky.social' });
    });

    this.shadow.getElementById('reauthorize')?.addEventListener('click', () => {
      void sendMessage({ type: 'AUTH_REAUTHORIZE' });
    });

    this.shadow.querySelectorAll<HTMLButtonElement>('.account-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        const did = btn.dataset['did'];
        if (did) {
          void sendMessage({ type: 'AUTH_SWITCH_ACCOUNT', did }).then(() => {
            void this.loadAccounts();
          });
        }
      });
    });

    this.shadow.querySelectorAll<HTMLButtonElement>('.account-sign-out').forEach(btn => {
      btn.addEventListener('click', () => {
        const did = btn.dataset['did'];
        if (did) {
          void sendMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did }).then(() => {
            void this.loadAccounts();
          });
        }
      });
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
