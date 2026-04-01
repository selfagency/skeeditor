import './account-card';
import type { AuthListAccountsAccount } from '../messages';
import { sendMessage } from '../messages';
import { showOptionsToast } from './options-toast';

export class OptionsAccounts extends HTMLElement {
  private readonly root: ShadowRoot;
  private accountsList: HTMLElement | null = null;

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
    this.attachHandlers();
    void this.loadAccounts();
  }

  private render(): void {
    this.root.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          overflow: hidden;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface-raised);
        }
        .card-header {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-header h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .card-section {
          padding: 1.25rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-section:last-child { border-bottom: none; }
        .accounts-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .accounts-list > li {
          padding: 1rem 1.5rem;
        }
        .accounts-list > li:not(:last-child) {
          border-bottom: 1px solid var(--color-border);
        }
        .empty-text { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }
        .err-text { margin: 0; font-size: 0.875rem; color: var(--color-error); }
        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary);
        }
        input[type="url"] {
          display: block; width: 100%; margin-top: 0.5rem; box-sizing: border-box;
          border-radius: 0.375rem; padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          color: var(--color-input-text);
          background: var(--color-input-bg);
          border: 1px solid var(--color-input-border);
          outline: none;
        }
        input[type="url"]:focus {
          border-color: var(--color-input-focus);
          box-shadow: 0 0 0 1px var(--color-input-focus);
        }
        input[type="url"]::placeholder { color: var(--color-input-placeholder); }
        .add-section { display: flex; flex-direction: column; gap: 1rem; }
        .add-section h3 {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        button.add-btn {
          align-self: flex-start;
          border-radius: 0.375rem; padding: 0.5rem 0.75rem;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          color: var(--color-secondary-text);
          background: var(--color-secondary-bg);
          border: 1px solid var(--color-secondary-border);
          box-shadow: 0 1px 2px 0 oklch(0% 0 none / 0.05);
        }
        button.add-btn:hover { background: var(--color-secondary-bg-hover); }
      </style>
      <div class="card">
        <div class="card-header"><h2>Accounts</h2></div>
        <div class="card-section">
          <ul role="list" class="accounts-list" id="accounts-list">
            <li><p class="empty-text">Loading accounts…</p></li>
          </ul>
        </div>
        <div class="card-section add-section">
          <h3>Add account</h3>
          <div>
            <label for="add-pds-url">PDS URL</label>
            <input type="url" id="add-pds-url" value="https://bsky.social" placeholder="https://bsky.social" />
          </div>
          <button class="add-btn" id="add-account" type="button">Add account</button>
        </div>
      </div>
    `;

    this.accountsList = this.root.getElementById('accounts-list');
  }

  private attachHandlers(): void {
    this.root.getElementById('add-account')?.addEventListener('click', () => {
      const input = this.root.getElementById('add-pds-url') as HTMLInputElement | null;
      const pdsUrl = input?.value?.trim() || '';
      if (!pdsUrl.startsWith('https://')) {
        this.emitStatus('Please enter a valid HTTPS URL (e.g. https://bsky.social).', 'error');
        return;
      }
      void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
    });

    this.root.addEventListener('account-switch', (event: Event) => {
      const did = (event as CustomEvent<{ did?: string }>).detail?.did ?? '';
      void this.handleSwitchAccount(did);
    });

    this.root.addEventListener('account-remove', (event: Event) => {
      const did = (event as CustomEvent<{ did?: string }>).detail?.did ?? '';
      void this.handleRemoveAccount(did);
    });
  }

  private async loadAccounts(): Promise<void> {
    try {
      const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
      this.renderAccounts(response.accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      if (this.accountsList) {
        this.accountsList.innerHTML = '';
        const li = document.createElement('li');
        const p = document.createElement('p');
        p.className = 'err-text';
        p.textContent = 'Failed to load accounts.';
        li.appendChild(p);
        this.accountsList.appendChild(li);
      }
    }
  }

  private renderAccounts(accounts: AuthListAccountsAccount[]): void {
    if (!this.accountsList) return;

    if (accounts.length === 0) {
      this.accountsList.innerHTML = '';
      const li = document.createElement('li');
      const p = document.createElement('p');
      p.className = 'empty-text';
      p.textContent = 'No accounts signed in.';
      li.appendChild(p);
      this.accountsList.appendChild(li);
      return;
    }

    this.accountsList.innerHTML = '';
    for (const account of accounts) {
      const li = document.createElement('li');
      const card = document.createElement('account-card');
      card.className = 'account-card';
      card.setAttribute('did', account.did);
      card.setAttribute('switch-label', 'Set active');
      card.setAttribute('remove-label', 'Remove');
      if (account.handle) card.setAttribute('handle', account.handle);
      if (account.isActive) card.setAttribute('is-active', 'true');
      li.appendChild(card);
      this.accountsList.appendChild(li);
    }
  }

  private async handleSwitchAccount(did: string): Promise<void> {
    if (!did) return;
    try {
      await sendMessage({ type: 'AUTH_SWITCH_ACCOUNT', did });
      this.emitStatus('Active account updated.', 'success');
      await this.loadAccounts();
    } catch (error) {
      console.error('Error switching account:', error);
      this.emitStatus('Failed to switch account.', 'error');
    }
  }

  private async handleRemoveAccount(did: string): Promise<void> {
    if (!did) return;
    try {
      await sendMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did });
      this.emitStatus('Account removed.', 'success');
      await this.loadAccounts();
    } catch (error) {
      console.error('Error removing account:', error);
      this.emitStatus('Failed to remove account.', 'error');
    }
  }

  private emitStatus(message: string, type: 'info' | 'success' | 'error'): void {
    showOptionsToast(message, type);
    this.dispatchEvent(
      new CustomEvent('status-update', {
        detail: { message, type },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get('options-accounts')) {
  customElements.define('options-accounts', OptionsAccounts);
}
