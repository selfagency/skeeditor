import browser from 'webextension-polyfill';
import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from './message-router';

console.info(`${APP_NAME}: background worker loaded`);

// Clear any stale PKCE auth state persisted in local storage from a previous service-worker
// lifecycle. browser.storage.session is preferred (auto-cleared on SW restart), but Firefox
// falls back to local storage which survives restarts. Clearing it here ensures a stale
// code_verifier from a previous session can never be matched against a new auth attempt.
void browser.storage.local.remove('pendingAuth').catch(() => {
  // Best-effort; failure is not critical.
});

registerMessageRouter();
