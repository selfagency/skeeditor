import browser from 'webextension-polyfill';
import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from './message-router';

console.info(`${APP_NAME}: background worker loaded`);

// Clear any stale PKCE auth state persisted in local storage from a previous service-worker
// lifecycle. browser.storage.session is preferred (auto-cleared on SW restart), but Firefox
// falls back to local storage which survives restarts. Clearing very old entries here ensures
// a stale code_verifier from a previous session can never be matched against a new auth
// attempt, while avoiding wiping legitimate in-progress auth state on service-worker restart.

// Only attempt this cleanup when storage.session is unavailable (i.e., when PKCE state may
// be backed by storage.local and persist across restarts).
if (!('session' in browser.storage)) {
  const PENDING_AUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

  void (async () => {
    try {
      const { pendingAuth } = await browser.storage.local.get('pendingAuth');
      if (!pendingAuth) {
        return;
      }

      const createdAt =
        typeof pendingAuth.createdAt === 'number' ? pendingAuth.createdAt : undefined;

      if (createdAt === undefined) {
        // Without a timestamp, we can't confidently treat this as stale; leave it in place.
        return;
      }

      const now = Date.now();
      if (now - createdAt > PENDING_AUTH_TTL_MS) {
        await browser.storage.local.remove('pendingAuth');
      }
    } catch {
      // Best-effort; failure is not critical.
    }
  })();
}
registerMessageRouter();
