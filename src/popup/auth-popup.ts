import { browser } from 'wxt/browser';

import globalStyles from '../shadow-styles.css?inline';
import '../shared/components/accounts-list';
import { LABELER_DID } from '../shared/constants';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { createStyleElement, createSvgNode } from '../shared/utils/dom';
import type { SkeeditorAccountsList } from '../shared/components/accounts-list';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

const LABELER_SUBSCRIBE_URL = `https://bsky.app/profile/${LABELER_DID}`;
const BUG_REPORT_URL = 'https://github.com/selfagency/skeeditor/issues/new?template=bug-report.yml';
const EXTENSION_VERSION =
  typeof __SKEEDITOR_VERSION__ === 'string' && __SKEEDITOR_VERSION__.length > 0 ? __SKEEDITOR_VERSION__ : 'dev';
const EXTENSION_COMMIT_SHA =
  typeof __SKEEDITOR_COMMIT_SHA__ === 'string' && __SKEEDITOR_COMMIT_SHA__.length > 0
    ? __SKEEDITOR_COMMIT_SHA__
    : 'unknown';
const BUILD_INFO_TEXT = `v${EXTENSION_VERSION} · ${EXTENSION_COMMIT_SHA}`;

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
    const container = document.createElement('div');
    container.className = 'flex flex-col';
    container.append(this.renderStateContent(), this.renderBuildInfoFooter());

    this.shadow.replaceChildren(
      createStyleElement(`${globalStyles}
      :host { display: block; color: var(--color-text-primary); min-width: 22rem; }
      .popup-section { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
      .loading-state { display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
      .muted { color: var(--color-text-secondary); font-size: 0.875rem; }
      .field-label { display:block; font-size:0.875rem; font-weight:600; color:var(--color-text-primary); }
      .field-control { margin-top:0.5rem; }
      .input {
        display:block; width:100%; box-sizing:border-box; border-radius:var(--radius-control);
        background:var(--color-input-bg); padding:0.5rem 0.75rem; font-size:0.875rem;
        color:var(--color-input-text); border:1px solid var(--color-input-border);
      }
      .input::placeholder { color: var(--color-input-placeholder); }
      .input:focus { outline:2px solid var(--color-input-focus); outline-offset:-1px; }
      .btn {
        display:flex; width:100%; align-items:center; justify-content:center; gap:0.375rem;
        border-radius:var(--radius-control); padding:0.625rem 0.875rem; font-size:0.875rem; font-weight:600; cursor:pointer;
        border:1px solid transparent; text-decoration:none;
      }
      .btn-primary { background:var(--color-primary); color:var(--color-primary-text); }
      .btn-primary:hover { background:var(--color-primary-hover); }
      .banner {
        border-radius:var(--radius-card); border:1px solid color-mix(in oklab, var(--color-primary) 35%, transparent);
        background:var(--color-primary-soft-bg); padding:0.875rem;
      }
      .banner-copy { margin:0; font-size:0.75rem; line-height:1.5; color:var(--color-primary-soft-text); }
      .banner-link { margin-top:0.625rem; }
      .dismiss-btn {
        margin-top:0.375rem; width:100%; border:none; background:transparent; cursor:pointer;
        text-align:center; font-size:0.75rem; color:var(--color-text-secondary); padding:0.25rem 0;
      }
      .dismiss-btn:hover { color:var(--color-text-primary); }
      .popup-footer-links { border-top:1px solid var(--color-border); padding-top:0.75rem; }
      .link-btn {
        display:flex; width:100%; align-items:center; justify-content:center; gap:0.375rem;
        border:none; background:transparent; border-radius:var(--radius-control); padding:0.5rem 0.75rem;
        color:var(--color-text-secondary); cursor:pointer; text-decoration:none;
      }
      .link-btn:hover { background:var(--color-secondary-bg-hover); color:var(--color-text-primary); }
      .link-btn.report { font-size:0.75rem; }
      .build-footer { border-top:1px solid var(--color-border); padding:0.5rem 1rem; text-align:center; }
      .build-info { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:0.75rem; color:var(--color-text-muted); }
    `),
      container,
    );
    this.attachHandlers();
  }

  private renderStateContent(): HTMLElement {
    switch (this.state) {
      case 'loading': {
        const loading = document.createElement('div');
        loading.className = 'loading-state';
        const text = document.createElement('span');
        text.className = 'loading muted';
        text.textContent = 'Checking authentication…';
        loading.appendChild(text);
        return loading;
      }
      case 'unauthenticated': {
        const section = document.createElement('div');
        section.className = 'popup-section';

        const description = document.createElement('p');
        description.className = 'muted';
        description.textContent = 'Sign in with your Bluesky account to edit posts.';

        const field = document.createElement('div');
        const label = document.createElement('label');
        label.htmlFor = 'pds-url';
        label.className = 'field-label';
        label.textContent = 'PDS URL';
        const control = document.createElement('div');
        control.className = 'field-control';
        const input = document.createElement('input');
        input.type = 'url';
        input.id = 'pds-url';
        input.value = 'https://bsky.social';
        input.placeholder = 'https://bsky.social';
        input.className = 'input';
        control.appendChild(input);
        field.append(label, control);

        const signIn = document.createElement('button');
        signIn.id = 'sign-in';
        signIn.type = 'button';
        signIn.className = 'btn btn-primary';
        signIn.textContent = 'Sign in with Bluesky';

        section.append(description, field, signIn);
        return section;
      }
      case 'authenticated': {
        const section = document.createElement('div');
        section.className = 'popup-section';

        if (this.showLabelerPrompt) {
          const banner = document.createElement('div');
          banner.className = 'banner';
          const copy = document.createElement('p');
          copy.className = 'banner-copy';
          copy.append(
            'Labeler subscription is managed on Bluesky. This opens Bluesky so you can subscribe there and see ',
          );
          const strong = document.createElement('strong');
          strong.textContent = 'Edited';
          copy.append(strong, ' labels on posts.');

          const subscribe = document.createElement('a');
          subscribe.id = 'subscribe-labeler';
          subscribe.href = LABELER_SUBSCRIBE_URL;
          subscribe.target = '_blank';
          subscribe.rel = 'noopener noreferrer';
          subscribe.className = 'btn btn-primary banner-link';
          subscribe.textContent = 'Open labeler profile';

          const dismiss = document.createElement('button');
          dismiss.id = 'dismiss-labeler-prompt';
          dismiss.type = 'button';
          dismiss.className = 'dismiss-btn';
          dismiss.textContent = 'Not now';

          banner.append(copy, subscribe, dismiss);
          section.appendChild(banner);
        }

        const accountsList = document.createElement('skeeditor-accounts-list') as SkeeditorAccountsList;
        accountsList.id = 'popup-accounts-list';
        accountsList.setAttribute('show-reauthorize', 'true');

        const footerLinks = document.createElement('div');
        footerLinks.className = 'popup-footer-links';

        const settingsButton = document.createElement('button');
        settingsButton.id = 'open-settings';
        settingsButton.type = 'button';
        settingsButton.className = 'link-btn';
        settingsButton.append(this.createSettingsIcon(), 'Settings');

        const reportBug = document.createElement('a');
        reportBug.id = 'report-bug';
        reportBug.href = BUG_REPORT_URL;
        reportBug.target = '_blank';
        reportBug.rel = 'noopener noreferrer';
        reportBug.className = 'link-btn report';
        reportBug.textContent = 'Report a bug';

        footerLinks.append(settingsButton, reportBug);
        section.append(accountsList, footerLinks);
        return section;
      }
    }
  }

  private createSettingsIcon(): SVGSVGElement {
    const icon = createSvgNode('svg', {
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      class: 'size-4',
      'aria-hidden': 'true',
    });
    icon.appendChild(
      createSvgNode('path', {
        'fill-rule': 'evenodd',
        d: 'M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.38-.966a.5.5 0 0 1 .633.062l.775.775a.5.5 0 0 1 .062.633l-.966 1.38c.25.417.441.872.562 1.356l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.966 1.38a.5.5 0 0 1-.062.633l-.775.775a.5.5 0 0 1-.633.062l-1.38-.966c-.417.25-.872.441-1.356.562l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a5.002 5.002 0 0 1-1.356-.562l-1.38.966a.5.5 0 0 1-.633-.062l-.775-.775a.5.5 0 0 1-.062-.633l.966-1.38a5.002 5.002 0 0 1-.562-1.356l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.966-1.38a.5.5 0 0 1 .062-.633l.775-.775a.5.5 0 0 1 .633-.062l1.38.966c.417-.25.872-.441 1.356-.562l.17-1.699ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
        'clip-rule': 'evenodd',
      }),
    );
    return icon;
  }

  private renderBuildInfoFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'build-footer';
    const buildInfo = document.createElement('span');
    buildInfo.id = 'build-info';
    buildInfo.className = 'build-info';
    buildInfo.title = `Skeeditor build ${BUILD_INFO_TEXT}`;
    buildInfo.textContent = BUILD_INFO_TEXT;
    footer.appendChild(buildInfo);
    return footer;
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

    const accountsList = this.shadow.getElementById('popup-accounts-list') as SkeeditorAccountsList | null;
    if (accountsList) {
      accountsList.accounts = this.accounts;
    }
  }
}

if (!customElements.get('auth-popup')) {
  customElements.define('auth-popup', AuthPopup);
}
