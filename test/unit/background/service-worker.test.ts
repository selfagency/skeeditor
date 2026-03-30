import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@src/background/message-router', () => ({
  registerMessageRouter: vi.fn(),
}));

vi.mock('@src/background/service-worker', () => ({
  connectLabelerWs: vi.fn(),
  cleanupLabelerWs: vi.fn(),
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('service-worker', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should call registerMessageRouter on import', async () => {
    const { registerMessageRouter } = await import('@src/background/message-router');

    const entrypoint = await import('@src/entrypoints/background');
    entrypoint.default.main();

    expect(vi.mocked(registerMessageRouter)).toHaveBeenCalledOnce();
  });

  it('clears local pendingAuth when storage.session is unavailable and createdAt is stale', async () => {
    delete (globalThis.browser.storage as { session?: unknown }).session;
    await globalThis.browser.storage.local.set({
      pendingAuth: {
        state: 'test-state',
        codeVerifier: 'test-verifier',
        createdAt: Date.now() - 6 * 60 * 1000,
      },
    });

    const entrypoint = await import('@src/entrypoints/background');
    entrypoint.default.main();
    await flushPromises();

    expect(globalThis.browser.storage.local.remove).toHaveBeenCalledWith('pendingAuth');
  });

  it('clears local pendingAuth when storage.session is unavailable and createdAt is missing', async () => {
    delete (globalThis.browser.storage as { session?: unknown }).session;
    await globalThis.browser.storage.local.set({
      pendingAuth: {
        state: 'legacy-state',
        codeVerifier: 'legacy-verifier',
      },
    });

    const entrypoint = await import('@src/entrypoints/background');
    entrypoint.default.main();
    await flushPromises();

    expect(globalThis.browser.storage.local.remove).toHaveBeenCalledWith('pendingAuth');
  });
});
