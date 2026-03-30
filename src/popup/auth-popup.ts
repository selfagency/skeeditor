import { browser } from 'wxt/browser';

import globalStyles from '../shadow-styles.css?inline';
import '../shared/components/account-card';
import { LABELER_DID } from '../shared/constants';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { escapeHTML } from '../shared/utils/escape-html';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

const LABELER_SUBSCRIBE_URL = `https://bsky.app/profile/${LABELER_DID}`;
const BUG_REPORT_URL = 'https://github.com/selfagency/skeeditor/issues/new?template=bug-report.yml';

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
  private showLabelerPrompt = false;
  private readonly onAccountSwitch = (event: Event): void => {
    const did = (event as CustomEvent<{ did?: string }>).detail?.did;
    if (!did) return;
    void sendMessage({ type: 'AUTH_SWITCH_ACCOUNT', did }).then(() => {
      void this.loadAccounts();
    });
  };

  private readonly onAccountRemove = (event: Event): void => {
    const did = (event as CustomEvent<{ did?: string }>).detail?.did;
    if (!did) return;
    void sendMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did }).then(() => {
      void this.loadAccounts();
    });
  };

  private readonly onAccountReauthorize = (): void => {
    void sendMessage({ type: 'AUTH_REAUTHORIZE' });
  };

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    void this.loadAccounts();
  }

  private async loadAccounts(): Promise<void> {
    try {
      const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
      this.accounts = response.accounts;
      this.state = this.accounts.length > 0 ? 'authenticated' : 'unauthenticated';
    } catch (error) {
      // Ensure the popup does not stay stuck in the loading state if background
      // messaging fails (e.g., service worker not yet ready). Fall back to the
      // unauthenticated state so the UI remains usable.
      console.error('Failed to load accounts', error);
      this.accounts = [];
      this.state = 'unauthenticated';
    }
    try {
      const stored = await browser.storage.local.get('pendingLabelerPrompt');
      this.showLabelerPrompt = stored['pendingLabelerPrompt'] === true;
    } catch {
      this.showLabelerPrompt = false;
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

      case 'authenticated': {
        const labelerBanner = this.showLabelerPrompt
          ? `<div class="rounded-lg border border-indigo-500/30 bg-indigo-950/50 p-3">
              <p class="text-xs text-indigo-200">Subscribe to the skeeditor labeler to see
              <strong>Edited</strong> labels on posts in Bluesky.</p>
              <a id="subscribe-labeler" href="${escapeHTML(LABELER_SUBSCRIBE_URL)}" target="_blank" rel="noopener noreferrer"
                class="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                Subscribe to labeler
              </a>
              <button id="dismiss-labeler-prompt" type="button"
                class="mt-1.5 w-full text-center text-xs text-indigo-400 hover:text-indigo-200">Dismiss</button>
            </div>`
          : '';

        const accountCards = this.accounts.map(account => this.renderAccountCard(account)).join('');

        return `
          ${style}
          <div class="space-y-3 p-4">
            ${labelerBanner}
            ${accountCards}
            <div class="border-t border-gray-200 pt-3 dark:border-white/10">
              <button id="open-settings" type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4" aria-hidden="true">
                  <path fill-rule="evenodd" d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.38-.966a.5.5 0 0 1 .633.062l.775.775a.5.5 0 0 1 .062.633l-.966 1.38c.25.417.441.872.562 1.356l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.966 1.38a.5.5 0 0 1-.062.633l-.775.775a.5.5 0 0 1-.633.062l-1.38-.966c-.417.25-.872.441-1.356.562l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a5.002 5.002 0 0 1-1.356-.562l-1.38.966a.5.5 0 0 1-.633-.062l-.775-.775a.5.5 0 0 1-.062-.633l.966-1.38a5.002 5.002 0 0 1-.562-1.356l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.966-1.38a.5.5 0 0 1 .062-.633l.775-.775a.5.5 0 0 1 .633-.062l1.38.966c.417-.25.872-.441 1.356-.562l.17-1.699ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" />
                </svg>
                Settings
              </button>
              <a id="report-bug" href="${escapeHTML(BUG_REPORT_URL)}" target="_blank" rel="noopener noreferrer"
                class="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-3.5" aria-hidden="true">
                  <path d="M11.134 1.535c.7-.509 1.416-.942 2.076-1.155.649-.21 1.463-.267 2.069.34.603.601.568 1.411.368 2.07-.204.668-.63 1.399-1.13 2.109-.499.71-1.078 1.424-1.67 2.065a22.5 22.5 0 0 1-1.453 1.49c.26.45.444.943.544 1.46.116.6.074 1.27-.18 1.894-.258.632-.664 1.2-1.165 1.586a3.3 3.3 0 0 1-.665.4A2.5 2.5 0 0 1 9.2 14H6.8a2.5 2.5 0 0 1-.728-.206 3.3 3.3 0 0 1-.665-.4c-.501-.387-.907-.955-1.165-1.587-.254-.623-.296-1.293-.18-1.893.1-.517.284-1.01.544-1.46a22.5 22.5 0 0 1-1.453-1.49 25 25 0 0 1-1.67-2.066c-.5-.71-.926-1.44-1.13-2.109-.2-.659-.235-1.469.368-2.07.606-.607 1.42-.55 2.07-.34.659.213 1.375.646 2.075 1.155A9 9 0 0 1 6.2 2.573 3.6 3.6 0 0 1 8 2c.635 0 1.239.164 1.8.573a9 9 0 0 1 1.334-.038Z" />
                </svg>
                Report a bug
              </a>
            </div>
          </div>`;
      }
    }
  }

  private renderAccountCard(account: AuthListAccountsAccount): string {
    const attrs: string[] = ['class="account-card"', `did="${escapeHTML(account.did)}"`, 'show-reauthorize="true"'];

    if (account.handle) {
      attrs.push(`handle="${escapeHTML(account.handle)}"`);
    }

    if (account.isActive) {
      attrs.push('is-active="true"');
    }

    return `<account-card ${attrs.join(' ')}></account-card>`;
  }

  private attachHandlers(): void {
    this.shadow.getElementById('sign-in')?.addEventListener('click', () => {
      const pdsUrlInput = this.shadow.getElementById('pds-url') as HTMLInputElement | null;
      const pdsUrl = pdsUrlInput?.value?.trim() || 'https://bsky.social';
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
    });

    this.shadow.getElementById('open-settings')?.addEventListener('click', () => {
      void browser.runtime.openOptionsPage();
    });

    this.shadow.getElementById('subscribe-labeler')?.addEventListener('click', () => {
      // Dismiss the prompt once the user clicks through — they've seen it.
      void browser.storage.local.remove('pendingLabelerPrompt').then(() => {
        this.showLabelerPrompt = false;
        this.render();
      });
    });

    this.shadow.getElementById('dismiss-labeler-prompt')?.addEventListener('click', () => {
      void browser.storage.local.remove('pendingLabelerPrompt').then(() => {
        this.showLabelerPrompt = false;
        this.render();
      });
    });

    this.shadow.removeEventListener('account-switch', this.onAccountSwitch as EventListener);
    this.shadow.removeEventListener('account-remove', this.onAccountRemove as EventListener);
    this.shadow.removeEventListener('account-reauthorize', this.onAccountReauthorize as EventListener);

    this.shadow.addEventListener('account-switch', this.onAccountSwitch as EventListener);
    this.shadow.addEventListener('account-remove', this.onAccountRemove as EventListener);
    this.shadow.addEventListener('account-reauthorize', this.onAccountReauthorize as EventListener);
  }
}

if (!customElements.get('auth-popup')) {
  customElements.define('auth-popup', AuthPopup);
}
