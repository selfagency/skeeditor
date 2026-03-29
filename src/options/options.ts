import { EDIT_TIME_LIMIT_MAX, EDIT_TIME_LIMIT_MIN } from '../shared/constants';
import type { AuthListAccountsAccount } from '../shared/messages';
import { sendMessage } from '../shared/messages';
import { escapeHTML } from '../shared/utils/escape-html';

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
    accountsList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No accounts signed in.</p>';
    return;
  }

  accountsList.innerHTML = accounts
    .map(account => {
      const label = account.handle
        ? `<span class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(account.handle)}</span>`
        : `<span class="truncate font-mono text-xs text-gray-600 dark:text-gray-400">${escapeHTML(account.did)}</span>`;
      const activeIndicator = account.isActive
        ? `<svg class="ml-1 size-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 297 297" xmlns="http://www.w3.org/2000/svg" aria-label="Active account" role="img"><path d="m148.438 0c-39.368 0-77.125 15.639-104.96 43.477-27.838 27.838-43.477 65.594-43.477 104.96 0 39.367 15.639 77.125 43.477 104.96 27.838 27.838 65.594 43.477 104.96 43.477 39.367 0 77.125-15.639 104.96-43.477 27.838-27.838 43.477-65.594 43.477-104.96 0-39.367-15.639-77.125-43.477-104.96-27.838-27.838-65.594-43.477-104.96-43.477zm79.401 92.046-82.468 115.45v.003c-2.819 3.946-7.231 6.456-12.063 6.859-.461.033-.911.05-1.361.05-4.376.003-8.571-1.737-11.66-4.832l-49.48-49.48c-4.106-4.178-5.685-10.219-4.153-15.871 1.535-5.652 5.95-10.067 11.602-11.599s11.693.047 15.871 4.15l35.715 35.707 71.145-99.603c3.424-4.796 9.145-7.403 15.012-6.834 5.865.566 10.984 4.219 13.425 9.581 2.444 5.365 1.839 11.621-1.585 16.418h.001z" fill="currentColor" fill-rule="nonzero"/></svg>`
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
            <div class="min-w-0 flex-1 flex items-center gap-1">${label}${activeIndicator}</div>
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
