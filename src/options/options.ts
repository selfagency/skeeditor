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

function escapeHTML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Accounts ───────────────────────────────────────────────────────────────────

function renderAccounts(accounts: AuthListAccountsAccount[]): void {
  if (!accountsList) return;

  if (accounts.length === 0) {
    accountsList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No accounts signed in.</p>';
    return;
  }

  accountsList.innerHTML = accounts
    .map(account => {
      const label = account.handle
        ? `<span class="text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(account.handle)}</span>`
        : `<span class="break-all font-mono text-xs text-gray-600 dark:text-gray-400">${escapeHTML(account.did)}</span>`;
      const activeIndicator = account.isActive
        ? '<span class="ml-1 text-xs text-indigo-600 dark:text-indigo-400">(active)</span>'
        : '';
      const switchBtn = account.isActive
        ? ''
        : `<button type="button"
            class="account-switch rounded px-2 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            data-did="${escapeHTML(account.did)}">
            Set active
          </button>`;
      const removeBtn = `<button type="button"
          class="account-remove rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          data-did="${escapeHTML(account.did)}">
          Remove
        </button>`;

      return `
        <div class="account-card rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">${label}${activeIndicator}</div>
            <div class="flex shrink-0 items-center gap-1">
              ${switchBtn}
              ${removeBtn}
            </div>
          </div>
        </div>`;
    })
    .join('');

  accountsList.querySelectorAll<HTMLButtonElement>('.account-switch').forEach(btn => {
    btn.addEventListener('click', () => void handleSwitchAccount(btn.dataset['did'] ?? ''));
  });

  accountsList.querySelectorAll<HTMLButtonElement>('.account-remove').forEach(btn => {
    btn.addEventListener('click', () => void handleRemoveAccount(btn.dataset['did'] ?? ''));
  });
}

async function loadAccounts(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'AUTH_LIST_ACCOUNTS' });
    renderAccounts(response.accounts);
  } catch (error) {
    console.error('Error loading accounts:', error);
    if (accountsList) {
      accountsList.innerHTML = '<p class="text-sm text-red-400">Failed to load accounts.</p>';
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
