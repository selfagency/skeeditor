import '../shared/components/account-card';
import { EDIT_TIME_LIMIT_MAX, EDIT_TIME_LIMIT_MIN } from '../shared/constants';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';

// ── DOM refs ──────────────────────────────────────────────────────────────────

const status = document.querySelector<HTMLParagraphElement>('#status');
const accountsList = document.querySelector<HTMLDivElement>('#accounts-list');
const addPdsUrlInput = document.querySelector<HTMLInputElement>('#add-pds-url');
const addAccountButton = document.querySelector<HTMLButtonElement>('#add-account');
const editTimeLimitInput = document.querySelector<HTMLInputElement>('#edit-time-limit');
const saveButton = document.querySelector<HTMLButtonElement>('#save-settings');

// ── Helpers ────────────────────────────────────────────────────────────────────

function setStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  if (!status) return;
  status.textContent = message;
  status.className = `text-sm min-h-5 ${
    type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-blue-400'
  }`;
}

// ── Accounts ───────────────────────────────────────────────────────────────────

function renderAccounts(accounts: AuthListAccountsAccount[]): void {
  if (!accountsList) return;

  if (accounts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500 dark:text-gray-400';
    empty.textContent = 'No accounts signed in.';
    accountsList.replaceChildren(empty);
    return;
  }

  accountsList.replaceChildren();

  for (const account of accounts) {
    const card = document.createElement('account-card');
    card.className = 'account-card';
    card.setAttribute('did', account.did);
    card.setAttribute('switch-label', 'Set active');
    card.setAttribute('remove-label', 'Remove');

    if (account.handle) {
      card.setAttribute('handle', account.handle);
    }
    if (account.isActive) {
      card.setAttribute('is-active', 'true');
    }

    accountsList.appendChild(card);
  }
}

let accountEventHandlersAttached = false;

function ensureAccountEventHandlers(): void {
  if (!accountsList || accountEventHandlersAttached) return;

  accountsList.addEventListener('account-switch', event => {
    const did = (event as CustomEvent<{ did?: string }>).detail?.did ?? '';
    void handleSwitchAccount(did);
  });

  accountsList.addEventListener('account-remove', event => {
    const did = (event as CustomEvent<{ did?: string }>).detail?.did ?? '';
    void handleRemoveAccount(did);
  });

  accountEventHandlersAttached = true;
}

async function loadAccounts(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
    renderAccounts(response.accounts);
  } catch (error) {
    console.error('Error loading accounts:', error);
    if (accountsList) {
      const errMsg = document.createElement('p');
      errMsg.className = 'text-sm text-red-400';
      errMsg.textContent = 'Failed to load accounts.';
      accountsList.replaceChildren(errMsg);
    }
  }
}

async function handleSwitchAccount(did: string): Promise<void> {
  if (!did) return;
  try {
    await sendMessage({ type: 'AUTH_SWITCH_ACCOUNT', did });
    setStatus('Active account updated.', 'success');
    await loadAccounts();
  } catch (error) {
    console.error('Error switching account:', error);
    setStatus('Failed to switch account.', 'error');
  }
}

async function handleRemoveAccount(did: string): Promise<void> {
  if (!did) return;
  try {
    await sendMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did });
    setStatus('Account removed.', 'success');
    await loadAccounts();
  } catch (error) {
    console.error('Error removing account:', error);
    setStatus('Failed to remove account.', 'error');
  }
}

// ── Settings ───────────────────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  if (!editTimeLimitInput) return;
  try {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    if (!('error' in response)) {
      editTimeLimitInput.value = response.editTimeLimit === null ? '' : String(response.editTimeLimit);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings(): Promise<void> {
  if (!editTimeLimitInput || !saveButton) return;

  const rawEditTimeLimit = editTimeLimitInput.value.trim();
  const editTimeLimit = rawEditTimeLimit.length === 0 ? null : Number.parseFloat(rawEditTimeLimit);

  if (
    editTimeLimit !== null &&
    (!Number.isFinite(editTimeLimit) || editTimeLimit < EDIT_TIME_LIMIT_MIN || editTimeLimit > EDIT_TIME_LIMIT_MAX)
  ) {
    setStatus(
      `Edit time limit must be between ${EDIT_TIME_LIMIT_MIN} and ${EDIT_TIME_LIMIT_MAX} minutes, or left blank to disable.`,
      'error',
    );
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';

  try {
    const response = await sendMessage({ type: 'SET_SETTINGS', settings: { editTimeLimit } });
    if (!('ok' in response && response.ok)) {
      setStatus(('error' in response ? response.error : null) ?? 'Failed to save settings.', 'error');
      return;
    }
    setStatus(
      editTimeLimit === null
        ? 'Settings saved. Edit time limit disabled.'
        : `Settings saved. Edit time limit: ${editTimeLimit} minutes.`,
      'success',
    );
  } catch (error) {
    console.error('Error saving settings:', error);
    setStatus('Error saving settings.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────

if (editTimeLimitInput) {
  editTimeLimitInput.min = String(EDIT_TIME_LIMIT_MIN);
  editTimeLimitInput.max = String(EDIT_TIME_LIMIT_MAX);
  editTimeLimitInput.step = '0.5';
}

saveButton?.addEventListener('click', () => void saveSettings());

addAccountButton?.addEventListener('click', () => {
  const pdsUrl = addPdsUrlInput?.value?.trim() || '';
  if (!pdsUrl.startsWith('https://')) {
    setStatus('Please enter a valid HTTPS URL (e.g. https://bsky.social).', 'error');
    return;
  }
  void sendMessage({ type: 'AUTH_SIGN_IN', pdsUrl });
});

void loadAccounts();
void loadSettings();
ensureAccountEventHandlers();
