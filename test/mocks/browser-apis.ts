import { vi } from 'vitest';

interface BrowserRuntimeMock {
  onMessage: {
    addListener: (listener: (message: unknown) => unknown) => void;
    removeListener: (listener: (message: unknown) => unknown) => void;
  };
  sendMessage: (message: unknown) => Promise<{ ok: true }>;
  getURL: (path: string) => string;
}

interface BrowserTabsMock {
  create: (options: { url: string }) => Promise<{ id: number }>;
}

interface BrowserStorageAreaMock {
  get: (key: string) => Promise<Record<string, unknown>>;
  remove: (key: string) => Promise<void>;
  set: (value: Record<string, unknown>) => Promise<void>;
}

interface BrowserStorageMock {
  local: BrowserStorageAreaMock;
  session: BrowserStorageAreaMock;
}

interface BrowserApiMock {
  runtime: BrowserRuntimeMock;
  storage: BrowserStorageMock;
  tabs: BrowserTabsMock;
}

declare global {
  // chrome is Chrome-namespace alias used in a single content-layer test; browser
  // global typing comes from src/browser.d.ts (webextension-polyfill types).
  // eslint-disable-next-line no-var
  var chrome: BrowserApiMock;
}

const createBrowserApiMock = (): BrowserApiMock => {
  const store: Record<string, unknown> = {};

  return {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      getURL: vi.fn().mockImplementation((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn().mockImplementation((key: string) =>
          Promise.resolve(store[key] !== undefined ? { [key]: store[key] } : {}),
        ),
        remove: vi.fn().mockImplementation((key: string) => {
          delete store[key];
          return Promise.resolve();
        }),
        set: vi.fn().mockImplementation((value: Record<string, unknown>) => {
          Object.assign(store, value);
          return Promise.resolve();
        }),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  };
};

const assignMocks = (): void => {
  const mock = createBrowserApiMock();
  // Cast to the real polyfill type — the mock satisfies the subset used in tests.
  globalThis.browser = mock as unknown as typeof browser;
  globalThis.chrome = mock;
};

export const installBrowserApiMocks = (): void => {
  assignMocks();
};

export const resetBrowserApiMocks = (): void => {
  vi.clearAllMocks();
  assignMocks();
};
