import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/background/message-router', () => ({
  registerMessageRouter: vi.fn(),
}));

describe('service-worker', () => {
  it('should call registerMessageRouter on import', async () => {
    const { registerMessageRouter } = await import('@src/background/message-router');

    const entrypoint = await import('@src/entrypoints/background');
    entrypoint.default.main();

    expect(vi.mocked(registerMessageRouter)).toHaveBeenCalledOnce();
  });
});
