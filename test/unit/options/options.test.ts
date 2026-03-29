import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthListAccountsAccount } from '@src/shared/messages';

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const getAccountCards = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('account-card.account-card'));

const queryAcrossAccountCardShadows = <T extends Element>(selector: string): T[] => {
  return getAccountCards().flatMap(card => Array.from(card.shadowRoot?.querySelectorAll<T>(selector) ?? []));
};

// ── DOM helpers ───────────────────────────────────────────────────────────────

function setupDOM(): void {
  document.body.innerHTML = `
    <p id="status"></p>
    <div id="accounts-list"></div>
    <input id="add-pds-url" type="url" value="https://bsky.social" />
    <button id="add-account"></button>
    <input id="edit-time-limit" type="number" />
    <button id="save-settings">Save Settings</button>
  `;
}

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
    if (type === 'GET_SETTINGS') return { editTimeLimit: null };
    return { ok: true };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('options page', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadOptionsModule(): Promise<void> {
    mockSendMessage([]);
    await import('@src/options/options');
    await flushPromises();
  }

  // ── Accounts section ───────────────────────────────────────────────────────

  describe('accounts list', () => {
    it('shows "No accounts signed in" when there are no accounts', async () => {
      mockSendMessage([]);
      await import('@src/options/options');
      await flushPromises();

      expect(document.getElementById('accounts-list')?.textContent).toContain('No accounts signed in');
    });

    it('renders one card per account', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS')
          return {
            accounts: [
              makeAccount({ did: 'did:plc:user1', isActive: true }),
              makeAccount({ did: 'did:plc:user2', isActive: false }),
            ],
          };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      const cards = document.querySelectorAll('.account-card');
      expect(cards.length).toBe(2);
    });

    it('displays the handle when available', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [makeAccount({ handle: 'alice.bsky.social' })] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      const [card] = getAccountCards();
      expect(card?.shadowRoot?.textContent).toContain('alice.bsky.social');
    });

    it('shows "Set active" button only for non-active accounts', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS')
          return {
            accounts: [
              makeAccount({ did: 'did:plc:user1', isActive: true }),
              makeAccount({ did: 'did:plc:user2', isActive: false }),
            ],
          };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      const switchBtns = queryAcrossAccountCardShadows<HTMLButtonElement>('.account-switch');
      expect(switchBtns.length).toBe(1);
      expect(switchBtns[0]?.dataset['did']).toBe('did:plc:user2');
    });

    it('shows remove button for every account', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS')
          return {
            accounts: [
              makeAccount({ did: 'did:plc:user1', isActive: true }),
              makeAccount({ did: 'did:plc:user2', isActive: false }),
            ],
          };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      const removeBtns = queryAcrossAccountCardShadows('.account-remove');
      expect(removeBtns.length).toBe(2);
    });
  });

  // ── Account actions ────────────────────────────────────────────────────────

  describe('account actions', () => {
    it('sends AUTH_SWITCH_ACCOUNT with correct DID when "Set active" is clicked', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS')
          return {
            accounts: [
              makeAccount({ did: 'did:plc:user1', isActive: true }),
              makeAccount({ did: 'did:plc:user2', isActive: false }),
            ],
          };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      const [card] = getAccountCards().filter(accountCard => accountCard.getAttribute('did') === 'did:plc:user2');
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
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [makeAccount({ did: 'did:plc:testuser123' })] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
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
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        return { ok: true };
      });

      await import('@src/options/options');
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

      expect(document.getElementById('accounts-list')?.textContent).toContain('No accounts signed in');
    });

    it('sends AUTH_SIGN_IN with pdsUrl when add-account is clicked', async () => {
      await loadOptionsModule();

      const pdsInput = document.getElementById('add-pds-url') as HTMLInputElement;
      pdsInput.value = 'https://pds.example.com';

      document.getElementById('add-account')?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_SIGN_IN',
        pdsUrl: 'https://pds.example.com',
      });
    });

    it('shows an error and does not send AUTH_SIGN_IN for a non-https pdsUrl', async () => {
      await loadOptionsModule();

      const pdsInput = document.getElementById('add-pds-url') as HTMLInputElement;
      pdsInput.value = 'http://not-secure.example.com';

      document.getElementById('add-account')?.click();
      await flushPromises();

      expect(document.getElementById('status')?.textContent).toContain('valid HTTPS URL');
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
        if (type === 'GET_SETTINGS') return { editTimeLimit: 2.5 };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      expect((document.getElementById('edit-time-limit') as HTMLInputElement).value).toBe('2.5');
    });

    it('sends SET_SETTINGS with the entered value when save is clicked', async () => {
      await loadOptionsModule();

      const input = document.getElementById('edit-time-limit') as HTMLInputElement;
      input.value = '2';

      document.getElementById('save-settings')?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'SET_SETTINGS',
        settings: { editTimeLimit: 2 },
      });
    });

    it('sends SET_SETTINGS with null when edit-time-limit is left blank', async () => {
      await loadOptionsModule();

      const input = document.getElementById('edit-time-limit') as HTMLInputElement;
      input.value = '';

      document.getElementById('save-settings')?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'SET_SETTINGS',
        settings: { editTimeLimit: null },
      });
    });

    it('shows an error status when save fails', async () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
        const type = (msg as { type?: string })?.type;
        if (type === 'AUTH_LIST_ACCOUNTS') return { accounts: [] };
        if (type === 'GET_SETTINGS') return { editTimeLimit: null };
        if (type === 'SET_SETTINGS') return { error: 'Storage full' };
        return { ok: true };
      });

      await import('@src/options/options');
      await flushPromises();

      document.getElementById('save-settings')?.click();
      await flushPromises();

      expect(document.getElementById('status')?.textContent).toContain('Storage full');
    });
  });
});
