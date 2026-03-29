import '@src/popup/auth-popup';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthListAccountsAccount } from '@src/shared/messages';

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const makeAccount = (overrides: Partial<AuthListAccountsAccount> = {}): AuthListAccountsAccount => ({
  did: 'did:plc:testuser123',
  expiresAt: Date.now() + 60_000,
  isActive: true,
  ...overrides,
});

const mockSendMessage = (accounts: AuthListAccountsAccount[]): void => {
  vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg: unknown) => {
    if ((msg as { type: string })?.type === 'AUTH_LIST_ACCOUNTS') {
      return { accounts };
    }
    return { ok: true };
  });
};

const createElement = (): HTMLElement => document.createElement('auth-popup');

const attach = async (el: HTMLElement): Promise<void> => {
  document.body.appendChild(el);
  await flushPromises();
};

const getAccountCards = (el: HTMLElement): HTMLElement[] =>
  Array.from(el.shadowRoot?.querySelectorAll<HTMLElement>('account-card.account-card') ?? []);

const queryAcrossAccountCardShadows = <T extends Element>(el: HTMLElement, selector: string): T[] => {
  return getAccountCards(el).flatMap(card => Array.from(card.shadowRoot?.querySelectorAll<T>(selector) ?? []));
};

describe('auth-popup Web Component', () => {
  beforeEach(() => {
    mockSendMessage([]);
  });

  describe('loading state', () => {
    it('renders a loading indicator before the account list resolves', () => {
      vi.mocked(browser.runtime.sendMessage).mockImplementation(() => new Promise(() => {}));

      const el = createElement();
      document.body.appendChild(el);

      expect(el.shadowRoot?.querySelector('.loading')).not.toBeNull();
    });

    it('falls back to unauthenticated state when AUTH_LIST_ACCOUNTS rejects', async () => {
      vi.mocked(browser.runtime.sendMessage).mockRejectedValue(new Error('Service worker not ready'));

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#sign-in')).not.toBeNull();
      expect(el.shadowRoot?.querySelector('.loading')).toBeNull();
    });
  });

  describe('unauthenticated state', () => {
    it('shows a sign-in button when no accounts exist', async () => {
      mockSendMessage([]);

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#sign-in')).not.toBeNull();
      expect(el.shadowRoot?.querySelector('.account-sign-out')).toBeNull();
    });

    it('shows a PDS URL input in unauthenticated state', async () => {
      mockSendMessage([]);

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#pds-url')).not.toBeNull();
    });
  });

  describe('authenticated state (single account)', () => {
    it('shows the DID when a valid account exists', async () => {
      mockSendMessage([makeAccount()]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
      expect(card?.shadowRoot?.textContent).toContain('did:plc:testuser123');
    });

    it('shows handle instead of DID when handle is available', async () => {
      mockSendMessage([makeAccount({ handle: 'alice.bsky.social' })]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
      expect(card?.shadowRoot?.textContent).toContain('alice.bsky.social');
    });

    it('shows reauthorize and sign-out buttons for active account', async () => {
      mockSendMessage([makeAccount({ isActive: true })]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
      expect(card?.shadowRoot?.querySelector('#reauthorize')).not.toBeNull();
      expect(card?.shadowRoot?.querySelector('.account-sign-out')).not.toBeNull();
      expect(el.shadowRoot?.querySelector('#sign-in')).toBeNull();
    });

    it('does not show a switch button for the sole active account', async () => {
      mockSendMessage([makeAccount({ isActive: true })]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
      expect(card?.shadowRoot?.querySelector('.account-switch')).toBeNull();
    });

    it('does not show an add-account button (moved to settings page)', async () => {
      mockSendMessage([makeAccount()]);

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#add-account')).toBeNull();
    });

    it('does not show a PDS URL input in authenticated state (moved to settings page)', async () => {
      mockSendMessage([makeAccount()]);

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#add-pds-url')).toBeNull();
    });
  });

  describe('authenticated state (multiple accounts)', () => {
    it('renders a card for each account', async () => {
      mockSendMessage([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const el = createElement();
      await attach(el);

      expect(getAccountCards(el).length).toBe(2);
    });

    it('shows a switch button only for the non-active account', async () => {
      mockSendMessage([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const el = createElement();
      await attach(el);

      const switchBtns = queryAcrossAccountCardShadows<HTMLButtonElement>(el, '.account-switch');
      expect(switchBtns.length).toBe(1);
      expect(switchBtns[0]?.dataset['did']).toBe('did:plc:user2');
    });

    it('shows per-account sign-out buttons for all accounts', async () => {
      mockSendMessage([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const el = createElement();
      await attach(el);

      const signOutBtns = queryAcrossAccountCardShadows(el, '.account-sign-out');
      expect(signOutBtns.length).toBe(2);
    });
  });

  describe('messages', () => {
    it('sends AUTH_SIGN_IN when sign-in button is clicked', async () => {
      mockSendMessage([]);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-in')?.click();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_SIGN_IN',
        pdsUrl: expect.any(String),
      });
    });

    it('shows a settings button that opens the options page from authenticated state', async () => {
      mockSendMessage([makeAccount()]);

      const el = createElement();
      await attach(el);

      expect(el.shadowRoot?.querySelector('#open-settings')).not.toBeNull();
    });

    it('sends AUTH_SIGN_OUT_ACCOUNT with the correct DID when per-account sign-out is clicked', async () => {
      mockSendMessage([makeAccount({ did: 'did:plc:testuser123', isActive: true })]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
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

    it('transitions to unauthenticated after signing out the last account', async () => {
      mockSendMessage([makeAccount({ did: 'did:plc:testuser123', isActive: true })]);

      const el = createElement();
      await attach(el);

      // After sign-out, return empty accounts
      mockSendMessage([]);

      const [card] = getAccountCards(el);
      card?.dispatchEvent(
        new CustomEvent('account-remove', {
          detail: { did: 'did:plc:testuser123' },
          bubbles: true,
          composed: true,
        }),
      );
      await flushPromises();
      await flushPromises();

      expect(el.shadowRoot?.querySelector('#sign-in')).not.toBeNull();
    });

    it('sends AUTH_SWITCH_ACCOUNT with the correct DID when switch is clicked', async () => {
      mockSendMessage([
        makeAccount({ did: 'did:plc:user1', isActive: true }),
        makeAccount({ did: 'did:plc:user2', isActive: false }),
      ]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el).filter(accountCard => accountCard.getAttribute('did') === 'did:plc:user2');
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

    it('sends AUTH_REAUTHORIZE when reauthorize button is clicked', async () => {
      mockSendMessage([makeAccount({ isActive: true })]);

      const el = createElement();
      await attach(el);

      const [card] = getAccountCards(el);
      card?.dispatchEvent(new CustomEvent('account-reauthorize', { bubbles: true, composed: true }));

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_REAUTHORIZE',
      });
    });

    it('opens options page when the settings button is clicked', async () => {
      mockSendMessage([makeAccount({ isActive: true })]);
      vi.mocked(browser.runtime.openOptionsPage).mockResolvedValue(undefined);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#open-settings')?.click();

      expect(vi.mocked(browser.runtime.openOptionsPage)).toHaveBeenCalled();
    });
  });
});
