import type { BrowserContext } from '@playwright/test';

import { TEST_DID } from './bsky-route-extension';

interface ExtensionSettings {
  editTimeLimit: number | null;
  saveStrategy: 'edit' | 'recreate';
}

const DEFAULT_SESSION = {
  did: TEST_DID,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3_600_000,
  scope: 'atproto transition:generic',
};

export async function setExtensionSettings(
  context: BrowserContext,
  extensionId: string,
  settings: ExtensionSettings,
): Promise<void> {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.evaluate(
    async ({ did, session, settingsValue }) => {
      await chrome.storage.local.set({
        sessions: { [did]: session },
        activeDid: did,
        settings: settingsValue,
      });
    },
    { did: TEST_DID, session: DEFAULT_SESSION, settingsValue: settings },
  );
  await popupPage.close();
}
