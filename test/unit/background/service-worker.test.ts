import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/background/message-router', () => ({
  registerMessageRouter: vi.fn(),
}));

describe('service-worker', () => {
  it('should call registerMessageRouter on import', async () => {
    const { registerMessageRouter } = await import('@src/background/message-router');

    await import('@src/background/service-worker');

    expect(vi.mocked(registerMessageRouter)).toHaveBeenCalledOnce();
  });
});
