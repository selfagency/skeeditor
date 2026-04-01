import './account-card';

import type { AuthListAccountsAccount } from '../messages';

export class SkeeditorAccountsList extends HTMLElement {
  private readonly root: ShadowRoot;
  private _accounts: AuthListAccountsAccount[] = [];

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
  }

  public get accounts(): AuthListAccountsAccount[] {
    return this._accounts;
  }

  public set accounts(value: AuthListAccountsAccount[]) {
    this._accounts = Array.isArray(value) ? value : [];
    this.render();
  }

  public get switchLabel(): string {
    return this.getAttribute('switch-label') ?? 'Switch';
  }

  public get removeLabel(): string {
    return this.getAttribute('remove-label') ?? 'Sign out';
  }

  public get showReauthorize(): boolean {
    const value = this.getAttribute('show-reauthorize');
    return value === '' || value === 'true';
  }

  private render(): void {
    this.root.innerHTML = `
      <style>
        :host { display: block; }
        .surface {
          overflow: hidden;
          border-radius: var(--radius-surface);
          background: var(--color-surface-subtle);
          outline: 1px solid var(--color-border-subtle);
          outline-offset: 0;
        }
        .accounts-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .accounts-list > li {
          padding: 1rem 1.5rem;
        }
        .accounts-list > li:not(:last-child) {
          border-bottom: 1px solid var(--color-border-subtle);
        }
      </style>
      <div class="surface">
        <ul role="list" class="accounts-list" id="accounts-list"></ul>
      </div>
    `;

    const list = this.root.getElementById('accounts-list');
    if (!list) return;

    for (const account of this._accounts) {
      const li = document.createElement('li');
      const card = document.createElement('account-card');
      card.className = 'account-card';
      card.setAttribute('did', account.did);
      card.setAttribute('switch-label', this.switchLabel);
      card.setAttribute('remove-label', this.removeLabel);
      if (account.handle) card.setAttribute('handle', account.handle);
      if (account.isActive) card.setAttribute('is-active', 'true');
      if (this.showReauthorize) card.setAttribute('show-reauthorize', 'true');
      li.appendChild(card);
      list.appendChild(li);
    }
  }
}

if (!customElements.get('skeeditor-accounts-list')) {
  customElements.define('skeeditor-accounts-list', SkeeditorAccountsList);
}
