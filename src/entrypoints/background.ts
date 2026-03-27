import { defineBackground } from 'wxt/utils/define-background';
import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from '../background/message-router';

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

  registerMessageRouter();
});
