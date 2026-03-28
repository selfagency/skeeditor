import { browser } from 'wxt/browser';

import globalStyles from '../shadow-styles.css?inline';
import { LABELER_DID } from '../shared/constants';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { escapeHTML } from '../shared/utils/escape-html';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

const LABELER_SUBSCRIBE_URL = `https://bsky.app/profile/${LABELER_DID}`;

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

        const accountCards = this.accounts
          .map(account => {
            const label = account.handle
              ? `<span class="text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(account.handle)}</span>`
              : `<span class="break-all font-mono text-xs text-gray-600 dark:text-gray-400">${escapeHTML(account.did)}</span>`;
            const activeIndicator = account.isActive
              ? '<span class="ml-1 text-xs text-indigo-600 dark:text-indigo-400">(active)</span>'
              : '';
            const switchBtn = account.isActive
              ? ''
              : `<button type="button" class="account-switch rounded px-2 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" data-did="${escapeHTML(account.did)}">Switch</button>`;
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
                  <button type="button" class="account-sign-out rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" data-did="${escapeHTML(account.did)}">Sign out</button>
                </div>
              </div>
            </div>`;
          })
          .join('');

        return `
          ${style}
          <div class="space-y-3 p-4">
            ${labelerBanner}
            ${accountCards}
            <div>
              <label for="add-pds-url" class="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">PDS URL</label>
              <div class="mt-2">
                <input type="url" id="add-pds-url" value="https://bsky.social" placeholder="https://bsky.social"
                  class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
              </div>
            </div>
            <button id="add-account" type="button"
              class="flex w-full justify-center rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20">
              Add another account
            </button>
            <div class="border-t border-gray-200 pt-3 dark:border-white/10">
              <button id="open-settings" type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4" aria-hidden="true">
                  <path fill-rule="evenodd" d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.38-.966a.5.5 0 0 1 .633.062l.775.775a.5.5 0 0 1 .062.633l-.966 1.38c.25.417.441.872.562 1.356l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.966 1.38a.5.5 0 0 1-.062.633l-.775.775a.5.5 0 0 1-.633.062l-1.38-.966c-.417.25-.872.441-1.356.562l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a5.002 5.002 0 0 1-1.356-.562l-1.38.966a.5.5 0 0 1-.633-.062l-.775-.775a.5.5 0 0 1-.062-.633l.966-1.38a5.002 5.002 0 0 1-.562-1.356l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.966-1.38a.5.5 0 0 1 .062-.633l.775-.775a.5.5 0 0 1 .633-.062l1.38.966c.417-.25.872-.441 1.356-.562l.17-1.699ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" />
                </svg>
                Settings
              </button>
            </div>
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
      const addPdsUrlInput = this.shadow.getElementById('add-pds-url') as HTMLInputElement | null;
      const pdsUrl = addPdsUrlInput?.value?.trim() || 'https://bsky.social';
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
    });

    this.shadow.getElementById('reauthorize')?.addEventListener('click', () => {
      void sendMessage({ type: 'AUTH_REAUTHORIZE' });
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
}

if (!customElements.get('auth-popup')) {
  customElements.define('auth-popup', AuthPopup);
}
