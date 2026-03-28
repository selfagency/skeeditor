import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from '../background/message-router';

// Tell TypeScript that `self` in this module is a ServiceWorkerGlobalScope,
// not a Window. Both DOM and WebWorker are in the project's lib, so TypeScript
// defaults to the DOM definition of `self`; this override corrects that for the
// background entrypoint which only ever runs inside a service worker.
declare const self: ServiceWorkerGlobalScope & typeof globalThis;

export default defineBackground(() => {
  console.info(`${APP_NAME}: background service worker started`);

  // SW lifecycle events — standard best-practice hooks for extension service workers.
  //
  // install: skipWaiting() makes the new SW version take over immediately rather
  //   than waiting for all tabs using the old version to close.
  //
  // activate: event.waitUntil() prevents Chrome from killing the SW until the
  //   provided Promise resolves; clients.claim() makes the SW take control of all
  //   open extension pages without requiring a reload.
  self.addEventListener('install', () => {
    void self.skipWaiting();
  });
  self.addEventListener('activate', (event: ExtendableEvent) => {
    // clients.claim() can throw InvalidStateError in Chrome MV3 under certain
    // conditions (e.g. racing activation during --load-extension dev reloads).
    // If the rejection propagates into event.waitUntil(), Chrome marks the
    // activate event as failed and the SW enters the "redundant" state — meaning
    // onMessage handlers are never registered and every sendMessage returns
    // undefined. Catch the rejection so activation always succeeds.
    event.waitUntil(
      self.clients.claim().catch((err: unknown) => {
        console.warn(`${APP_NAME}: clients.claim() failed (non-fatal)`, err);
      }),
    );
  });

  // Alarm keepalive: Chrome terminates idle MV3 service workers after ~30 seconds.
  // A periodic alarm at 24-second intervals wakes the SW before Chrome kills it.
  // Guard with try-catch: if the alarms API is unavailable (e.g. test environment),
  // do not crash the SW before registerMessageRouter() is called.
  try {
    browser.alarms.create('keepalive', { periodInMinutes: 0.4 });
    browser.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === 'keepalive') {
        console.debug(`${APP_NAME}: SW keepalive heartbeat`);
      }
    });
  } catch (err) {
    console.warn(`${APP_NAME}: alarms API unavailable, skipping alarm keepalive`, err);
  }

  // On install/activate, clear stale OAuth PKCE state that may have been written to
  // browser.storage.local on Firefox (where storage.session is unavailable). Any
  // pendingAuth older than 5 minutes from a previous lifecycle can never be redeemed.
  if (!('session' in browser.storage)) {
    const PENDING_AUTH_TTL_MS = 5 * 60 * 1000;
    void (async () => {
      try {
        const result = await browser.storage.local.get('pendingAuth');
        const record = (result as Record<string, unknown>)['pendingAuth'];
        if (!record) return;
        const createdAt =
          typeof (record as Record<string, unknown>)['createdAt'] === 'number'
            ? ((record as Record<string, unknown>)['createdAt'] as number)
            : undefined;
        if (createdAt !== undefined && Date.now() - createdAt > PENDING_AUTH_TTL_MS) {
          await browser.storage.local.remove('pendingAuth');
        }
      } catch {
        // Best-effort; failure here must never block the message router.
      }
    })();
  }

  registerMessageRouter();
});
