import { vi } from 'vitest';

interface BrowserRuntimeMock {
  onMessage: {
    addListener: (listener: (message: unknown) => unknown) => void;
    removeListener: (listener: (message: unknown) => unknown) => void;
  };
  sendMessage: (message: unknown) => Promise<{ ok: true }>;
  getURL: (path: string) => string;
  openOptionsPage: () => Promise<void>;
}

interface BrowserTabsMock {
  create: (options: { url: string }) => Promise<{ id: number }>;
}

interface BrowserStorageAreaMock {
  get: (key: string) => Promise<Record<string, unknown>>;
  remove: (key: string) => Promise<void>;
  set: (value: Record<string, unknown>) => Promise<void>;
}

interface BrowserStorageOnChangedMock {
  addListener: (listener: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void) => void;
  removeListener: (listener: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void) => void;
  /**
   * Test helper: fire the onChanged listeners with the given changes object.
   * Not part of the real browser API — used to simulate storage changes in tests.
   */
  _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void;
}

interface BrowserStorageMock {
  local: BrowserStorageAreaMock;
  session: BrowserStorageAreaMock;
  onChanged: BrowserStorageOnChangedMock;
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
      openOptionsPage: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        get: vi
          .fn()
          .mockImplementation((key: string) => Promise.resolve(store[key] !== undefined ? { [key]: store[key] } : {})),
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
      onChanged: (() => {
        const listeners: Array<(changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void> = [];
        return {
          addListener: vi
            .fn()
            .mockImplementation((fn: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void) => {
              listeners.push(fn);
            }),
          removeListener: vi
            .fn()
            .mockImplementation((fn: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void) => {
              const i = listeners.indexOf(fn);
              if (i !== -1) listeners.splice(i, 1);
            }),
          _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
            for (const fn of listeners) fn(changes);
          },
        };
      })(),
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
