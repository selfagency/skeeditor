import type { BrowserContext } from '@playwright/test';

import { TEST_DID } from './bsky-route-extension';

interface ExtensionSettings {
  editTimeLimit: number | null;
  saveStrategy: 'edit' | 'recreate';
}

interface StoredSession {
  did: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  handle?: string;
}

const DEFAULT_SESSION = {
  did: TEST_DID,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3_600_000,
  scope: 'atproto transition:generic',
};

export function createMockSession(did: string, handle?: string): StoredSession {
  return {
    did,
    accessToken: `mock-access-token-${did}`,
    refreshToken: `mock-refresh-token-${did}`,
    expiresAt: Date.now() + 3_600_000,
    scope: 'atproto transition:generic',
    ...(handle ? { handle } : {}),
  };
}

interface PopupAuthSeed {
  sessions: Record<string, StoredSession>;
  activeDid: string;
  settings?: ExtensionSettings;
  pendingLabelerPrompt?: boolean;
}

export async function seedPopupAuthState(
  context: BrowserContext,
  extensionId: string,
  seed: PopupAuthSeed,
): Promise<void> {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.evaluate(async ({ sessions, activeDid, settings, pendingLabelerPrompt }) => {
    const payload: Record<string, unknown> = { sessions, activeDid };
    if (settings !== undefined) payload['settings'] = settings;
    if (pendingLabelerPrompt !== undefined) payload['pendingLabelerPrompt'] = pendingLabelerPrompt;
    await chrome.storage.local.set(payload);
  }, seed);
  await popupPage.close();
}

export async function setExtensionSettings(
  context: BrowserContext,
  extensionId: string,
  settings: ExtensionSettings,
): Promise<void> {
  await seedPopupAuthState(context, extensionId, {
    sessions: { [TEST_DID]: DEFAULT_SESSION },
    activeDid: TEST_DID,
    settings,
  });
}
