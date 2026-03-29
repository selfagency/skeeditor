import type { AuthListAccountsAccount } from '../messages';
import { escapeHTML } from './escape-html';

// ─── Shared SVG assets ────────────────────────────────────────────────────────

export const ACTIVE_INDICATOR_SVG =
  `<svg class="ml-1 size-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" ` +
  `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" ` +
  `aria-label="Active account" role="img">` +
  `<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882` +
  `l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" ` +
  `clip-rule="evenodd"/></svg>`;

// ─── Shared button class tokens ───────────────────────────────────────────────

const BASE_BTN =
  'inline-flex items-center justify-center h-7 rounded px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2';
const INDIGO_BTN = `${BASE_BTN} bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-indigo-600`;
const RED_BTN = `${BASE_BTN} bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-red-600`;
const GHOST_BTN = `${BASE_BTN} bg-white text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20`;

// ─── Per-context button labels ────────────────────────────────────────────────

export interface AccountCardOptions {
  /** Label for the "switch to this account" button. Default: 'Switch'. */
  switchLabel?: string;
  /** Label for the destructive action button. Default: 'Sign out'. */
  removeLabel?: string;
  /** Whether to show a Reauthorize button for the active account. Default: false. */
  showReauthorize?: boolean;
}

// ─── Account label HTML ───────────────────────────────────────────────────────

export function accountLabel(account: AuthListAccountsAccount): string {
  return account.handle
    ? `<span class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">${escapeHTML(account.handle)}</span>`
    : `<span class="truncate font-mono text-xs text-gray-600 dark:text-gray-400">${escapeHTML(account.did)}</span>`;
}

// ─── Button builders ──────────────────────────────────────────────────────────

export function switchButton(did: string, label = 'Switch'): string {
  return `<button type="button" class="account-switch ${INDIGO_BTN}" data-did="${escapeHTML(did)}">${label}</button>`;
}

export function reauthorizeButton(): string {
  return `<button id="reauthorize" type="button" class="${GHOST_BTN}">Reauthorize</button>`;
}

export function removeButton(did: string, label = 'Sign out'): string {
  return `<button type="button" class="account-remove ${RED_BTN}" data-did="${escapeHTML(did)}">${label}</button>`;
}

// ─── Full account card ────────────────────────────────────────────────────────

export function accountCard(account: AuthListAccountsAccount, options: AccountCardOptions = {}): string {
  const { switchLabel = 'Switch', removeLabel = 'Sign out', showReauthorize = false } = options;

  const label = accountLabel(account);
  const indicator = account.isActive ? ACTIVE_INDICATOR_SVG : '';
  const switchBtn = account.isActive ? '' : switchButton(account.did, switchLabel);
  const reauthBtn = account.isActive && showReauthorize ? reauthorizeButton() : '';
  const removeBtn = removeButton(account.did, removeLabel);

  return `
    <div class="account-card rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1 flex items-center gap-1">${label}${indicator}</div>
        <div class="flex shrink-0 items-center gap-1">
          ${switchBtn}
          ${reauthBtn}
          ${removeBtn}
        </div>
      </div>
    </div>`;
}
