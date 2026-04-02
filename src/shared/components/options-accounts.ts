import './accounts-list';
import type { AuthListAccountsAccount } from '../messages';
import { sendMessage } from '../messages';
import { showOptionsToast } from './options-toast';
import type { SkeeditorAccountsList } from './accounts-list';

export class OptionsAccounts extends HTMLElement {
  private readonly root: ShadowRoot;
  private accountsContainer: HTMLElement | null = null;

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
          border-radius: var(--radius-card);
          border: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          box-shadow: 0 1px 2px 0 oklch(0% 0 none / 0.05);
        }
        .card-header {
          padding: 1.25rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-header h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .card-section {
          padding: 1.25rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-section:last-child { border-bottom: none; }
        .empty-text { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }
        .err-text { margin: 0; font-size: 0.875rem; color: var(--color-error); }
        .accounts-state {
          overflow: hidden;
          border-radius: var(--radius-surface);
          background: var(--color-surface-subtle);
          outline: 1px solid var(--color-border-subtle);
          outline-offset: 0;
          padding: 1rem 1.5rem;
        }
        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary);
        }
        input[type="url"] {
          display: block; width: 100%; margin-top: 0.5rem; box-sizing: border-box;
          border-radius: var(--radius-control); padding: 0.5rem 0.75rem;
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
          border-radius: var(--radius-control); padding: 0.5rem 0.875rem;
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
          <div id="accounts-container" class="accounts-state">
            <p class="empty-text">Loading accounts…</p>
          </div>
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

    this.accountsContainer = this.root.getElementById('accounts-container');
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
      if (this.accountsContainer) {
        this.accountsContainer.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'err-text';
        p.textContent = 'Failed to load accounts.';
        this.accountsContainer.appendChild(p);
      }
    }
  }

  private renderAccounts(accounts: AuthListAccountsAccount[]): void {
    if (!this.accountsContainer) return;

    if (accounts.length === 0) {
      this.accountsContainer.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'empty-text';
      p.textContent = 'No accounts signed in.';
      this.accountsContainer.appendChild(p);
      return;
    }

    this.accountsContainer.className = '';
    this.accountsContainer.innerHTML = '';
    const accountsList = document.createElement('skeeditor-accounts-list') as SkeeditorAccountsList;
    accountsList.setAttribute('switch-label', 'Set active');
    accountsList.setAttribute('remove-label', 'Remove');
    accountsList.accounts = accounts;
    this.accountsContainer.appendChild(accountsList);
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
