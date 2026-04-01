import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthListAccountsAccount } from '@src/shared/messages';
import type { OptionsAccounts } from '@src/shared/components/options-accounts';
import type { OptionsSettings } from '@src/shared/components/options-settings';
import type { OptionsStatus } from '@src/shared/components/options-status';

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

// ── DOM helpers ───────────────────────────────────────────────────────────────

let accountsEl: OptionsAccounts;
let settingsEl: OptionsSettings;
let statusEl: OptionsStatus;
let statusUpdateListener: ((event: Event) => void) | null = null;

const getAccountCards = (): HTMLElement[] => {
  const cards = accountsEl.shadowRoot?.querySelectorAll<HTMLElement>('account-card.account-card') ?? [];
  return Array.from(cards);
};

const queryAcrossAccountCardShadows = <T extends Element>(selector: string): T[] => {
  return getAccountCards().flatMap(card => Array.from(card.shadowRoot?.querySelectorAll<T>(selector) ?? []));
};

// ── Mock helpers ──────────────────────────────────────────────────────────────

const makeAccount = (overrides: Partial<AuthListAccountsAccount> = {}): AuthListAccountsAccount => ({
  did: 'did:plc:testuser123',
  expiresAt: Date.now() + 60_000,
  isActive: true,
  ...overrides,
});

function mockSendMessage(accounts: AuthListAccountsAccount[]): void {
  vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
    const type = (msg as { type?: string })?.type;
    if (type === 'AUTH_LIST_ACCOUNTS') return { accounts };
    if (type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };
    return { ok: true };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('options page', () => {
  beforeEach(async () => {
    // Register components
    await import('@src/shared/components/options-status');
    await import('@src/shared/components/options-accounts');
    await import('@src/shared/components/options-settings');
  });

  afterEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    if (statusUpdateListener !== null) {
      document.removeEventListener('status-update', statusUpdateListener);
      statusUpdateListener = null;
    }
  });

  async function setupComponents(accounts: AuthListAccountsAccount[] = []): Promise<void> {
    mockSendMessage(accounts);

    statusEl = document.createElement('options-status') as OptionsStatus;
    accountsEl = document.createElement('options-accounts') as OptionsAccounts;
    settingsEl = document.createElement('options-settings') as OptionsSettings;

    // Wire up status routing like main.ts does
    statusUpdateListener = (event: Event) => {
      const { message, type } = (event as CustomEvent<{ message: string; type: 'info' | 'success' | 'error' }>).detail;
      statusEl.setStatus(message, type);
    };
    document.addEventListener('status-update', statusUpdateListener);

    document.body.append(statusEl, accountsEl, settingsEl);
    await flushPromises();
  }

  // ── Accounts section ───────────────────────────────────────────────────────

  describe('accounts list', () => {
    it('shows "No accounts signed in" when there are no accounts', async () => {
      await setupComponents([]);

      const list = accountsEl.shadowRoot?.getElementById('accounts-list');
      expect(list?.textContent).toContain('No accounts signed in');
    });

    it('renders one card per account', async () => {
      await setupComponents([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const cards = getAccountCards();
      expect(cards.length).toBe(2);
    });

    it('displays the handle when available', async () => {
      await setupComponents([makeAccount({ handle: 'alice.bsky.social' })]);

      const [card] = getAccountCards();
      expect(card?.shadowRoot?.textContent).toContain('alice.bsky.social');
    });

    it('shows "Set active" button only for non-active accounts', async () => {
      await setupComponents([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const switchBtns = queryAcrossAccountCardShadows<HTMLButtonElement>('.account-switch');
      expect(switchBtns.length).toBe(1);
      expect(switchBtns[0]?.dataset['did']).toBe('did:plc:user2');
    });

    it('shows remove button for every account', async () => {
      await setupComponents([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const removeBtns = queryAcrossAccountCardShadows('.account-remove');
      expect(removeBtns.length).toBe(2);
    });

    it('shows error message when account loading fails', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') throw new Error('Network error');
        if (type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };
        return { ok: true };
      });

      accountsEl = document.createElement('options-accounts') as OptionsAccounts;
      document.body.appendChild(accountsEl);
      await flushPromises();

      const list = accountsEl.shadowRoot?.getElementById('accounts-list');
      expect(list?.textContent).toContain('Failed to load accounts');
    });
  });

  // ── Account actions ────────────────────────────────────────────────────────

  describe('account actions', () => {
    it('sends AUTH_SWITCH_ACCOUNT with correct DID when "Set active" is clicked', async () => {
      await setupComponents([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const [card] = getAccountCards().filter(c => c.getAttribute('did') === 'did:plc:user2');
      card?.dispatchEvent(
        new CustomEvent('account-switch', {
          detail: { did: 'did:plc:user2' },
          bubbles: true,
          composed: true,
        }),
      );
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_SWITCH_ACCOUNT',
        did: 'did:plc:user2',
      });
    });

    it('sends AUTH_SIGN_OUT_ACCOUNT with correct DID when remove is clicked', async () => {
      await setupComponents([makeAccount({ did: 'did:plc:testuser123' })]);

      const [card] = getAccountCards();
      card?.dispatchEvent(
        new CustomEvent('account-remove', {
          detail: { did: 'did:plc:testuser123' },
          bubbles: true,
          composed: true,
        }),
      );
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_SIGN_OUT_ACCOUNT',
        did: 'did:plc:testuser123',
      });
    });

    it('re-renders accounts after removing one', async () => {
      let callCount = 0;
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') {
          callCount++;
          return callCount === 1 ? { accounts: [makeAccount({ did: 'did:plc:testuser123' })] } : { accounts: [] };
        }
        if (type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };
        return { ok: true };
      });

      accountsEl = document.createElement('options-accounts') as OptionsAccounts;
      document.body.appendChild(accountsEl);
      await flushPromises();

      const [card] = getAccountCards();
      card?.dispatchEvent(
        new CustomEvent('account-remove', {
          detail: { did: 'did:plc:testuser123' },
          bubbles: true,
          composed: true,
        }),
      );
      await flushPromises();
      await flushPromises();

      const list = accountsEl.shadowRoot?.getElementById('accounts-list');
      expect(list?.textContent).toContain('No accounts signed in');
    });

    it('sends AUTH_SIGN_IN with pdsUrl when add-account is clicked', async () => {
      await setupComponents([]);

      const pdsInput = accountsEl.shadowRoot?.getElementById('add-pds-url') as HTMLInputElement;
      pdsInput.value = 'https://pds.example.com';

      (accountsEl.shadowRoot?.getElementById('add-account') as HTMLButtonElement)?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_SIGN_IN',
        pdsUrl: 'https://pds.example.com',
      });
    });

    it('emits a status-update error for a non-https pdsUrl and does not send AUTH_SIGN_IN', async () => {
      await setupComponents([]);
      const statusSpy = vi.fn();
      document.addEventListener('status-update', statusSpy);

      const pdsInput = accountsEl.shadowRoot?.getElementById('add-pds-url') as HTMLInputElement;
      pdsInput.value = 'http://not-secure.example.com';

      (accountsEl.shadowRoot?.getElementById('add-account') as HTMLButtonElement)?.click();
      await flushPromises();

      expect(statusSpy).toHaveBeenCalled();
      const firstEvent = statusSpy.mock.calls[0]?.[0];
      expect(firstEvent).toBeDefined();
      const detail = (firstEvent as CustomEvent).detail;
      expect(detail.message).toContain('valid HTTPS URL');
      expect(vi.mocked(browser.runtime.sendMessage)).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'AUTH_SIGN_IN' }),
      );
    });
  });

  // ── Settings section ───────────────────────────────────────────────────────

  describe('settings', () => {
    it('populates edit time limit from GET_SETTINGS on load', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: 2.5, saveStrategy: 'edit' };
        return { ok: true };
      });

      settingsEl = document.createElement('options-settings') as OptionsSettings;
      document.body.appendChild(settingsEl);
      await flushPromises();

      const input = settingsEl.shadowRoot?.getElementById('edit-time-limit') as HTMLInputElement;
      expect(input.value).toBe('2.5');
    });

    it('populates save strategy from GET_SETTINGS on load', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'recreate' };
        return { ok: true };
      });

      settingsEl = document.createElement('options-settings') as OptionsSettings;
      document.body.appendChild(settingsEl);
      await flushPromises();

      const select = settingsEl.shadowRoot?.getElementById('save-strategy') as HTMLSelectElement;
      expect(select.value).toBe('recreate');
    });

    it('sends SET_SETTINGS with the entered value when save is clicked', async () => {
      await setupComponents([]);

      const input = settingsEl.shadowRoot?.getElementById('edit-time-limit') as HTMLInputElement;
      input.value = '2';

      (settingsEl.shadowRoot?.getElementById('save-settings') as HTMLButtonElement)?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'SET_SETTINGS',
        settings: { editTimeLimit: 2, saveStrategy: 'edit' },
      });
    });

    it('sends SET_SETTINGS with null when edit-time-limit is left blank', async () => {
      await setupComponents([]);

      const input = settingsEl.shadowRoot?.getElementById('edit-time-limit') as HTMLInputElement;
      input.value = '';

      (settingsEl.shadowRoot?.getElementById('save-settings') as HTMLButtonElement)?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'SET_SETTINGS',
        settings: { editTimeLimit: null, saveStrategy: 'edit' },
      });
    });

    it('emits a status-update error when save fails', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };
        if (type === 'SET_SETTINGS') return { error: 'Storage full' };
        return { ok: true };
      });

      const statusSpy = vi.fn();
      document.addEventListener('status-update', statusSpy);

      settingsEl = document.createElement('options-settings') as OptionsSettings;
      document.body.appendChild(settingsEl);
      await flushPromises();

      (settingsEl.shadowRoot?.getElementById('save-settings') as HTMLButtonElement)?.click();
      await flushPromises();

      const firstEvent = statusSpy.mock.calls[0]?.[0];
      expect(firstEvent).toBeDefined();
      const detail = (firstEvent as CustomEvent).detail;
      expect(detail.message).toContain('Storage full');
    });

    it('sends SET_SETTINGS with recreate mode when selected', async () => {
      await setupComponents([]);

      const saveStrategySelect = settingsEl.shadowRoot?.getElementById('save-strategy');
      expect(saveStrategySelect).toBeInstanceOf(HTMLSelectElement);
      (saveStrategySelect as HTMLSelectElement).value = 'recreate';

      (settingsEl.shadowRoot?.getElementById('save-settings') as HTMLButtonElement)?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'SET_SETTINGS',
        settings: { editTimeLimit: null, saveStrategy: 'recreate' },
      });
    });
  });
});
