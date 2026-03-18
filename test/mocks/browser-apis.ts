import { vi } from 'vitest';

interface BrowserMessage {
  type: string;
}

interface BrowserPingResponse {
  ok: true;
}

interface BrowserRuntimeMock {
  onMessage: {
    addListener: () => void;
    removeListener: () => void;
  };
  sendMessage: (message: BrowserMessage) => Promise<BrowserPingResponse>;
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
}

declare global {
  var browser: BrowserApiMock;
  var chrome: BrowserApiMock;
}

const createBrowserApiMock = (): BrowserApiMock => ({
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    },
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
