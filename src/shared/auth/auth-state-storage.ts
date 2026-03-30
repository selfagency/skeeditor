import { browser } from 'wxt/browser';

type StorageArea = typeof browser.storage.local;

function isUsableStorageArea(area: unknown): area is StorageArea {
  if (area === null || typeof area !== 'object') return false;
  const record = area as Record<string, unknown>;
  return (
    typeof record['get'] === 'function' && typeof record['set'] === 'function' && typeof record['remove'] === 'function'
  );
}

export function hasUsableSessionStorage(): boolean {
  if (!('session' in browser.storage)) return false;
  return isUsableStorageArea((browser.storage as Record<string, unknown>)['session']);
}

export function getAuthStateStorageArea(): StorageArea {
  const session = (browser.storage as Record<string, unknown>)['session'];
  return isUsableStorageArea(session) ? session : browser.storage.local;
}
