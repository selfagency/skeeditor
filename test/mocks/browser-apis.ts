import { vi } from 'vitest';

interface BrowserMessage {
  type: string;
}

interface BrowserPingResponse {
  ok: true;
}

interface BrowserRuntimeMock {
  onMessage: {
    addListener: (listener: (message: unknown) => unknown) => void;
    removeListener: (listener: (message: unknown) => unknown) => void;
  };
  sendMessage: (message: BrowserMessage) => Promise<BrowserPingResponse>;
  getURL: (path: string) => string;
}

interface BrowserTabsMock {
  create: (options: { url: string }) => Promise<{ id: number }>;
}

interface BrowserStorageMock {
  local: {
    get: (key: string) => Promise<Record<string, never>>;
    remove: (key: string) => Promise<void>;
    set: (value: Record<string, unknown>) => Promise<void>;
  };
}

interface BrowserApiMock {
  runtime: BrowserRuntimeMock;
  storage: BrowserStorageMock;
  tabs: BrowserTabsMock;
}

declare global {
  // eslint-disable-next-line no-var
  var browser: BrowserApiMock;
  // eslint-disable-next-line no-var
  var chrome: BrowserApiMock;
}

const createBrowserApiMock = (): BrowserApiMock => ({
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
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
});

const assignMocks = (): void => {
  const mock = createBrowserApiMock();
  globalThis.browser = mock;
  globalThis.chrome = mock;
};

export const installBrowserApiMocks = (): void => {
  assignMocks();
};

export const resetBrowserApiMocks = (): void => {
  vi.clearAllMocks();
  assignMocks();
};
