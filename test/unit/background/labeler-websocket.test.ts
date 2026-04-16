import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encodeLabelFrame } from '../../../packages/labeler/src/label';
import { LABELER_BACKOFF_STORAGE_KEY } from '@src/shared/constants';

const flushPromises = async (count = 3): Promise<void> => {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
};

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  public readonly url: string;
  public readonly binaryType = 'arraybuffer';
  public readyState = MockWebSocket.CONNECTING;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(data: ArrayBuffer): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('background labeler websocket', () => {
  beforeEach(() => {
    vi.resetModules();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the stored cursor when opening the labeler websocket', async () => {
    await globalThis.browser.storage.local.set({ labelerCursor: 42 });

    const { connectLabelerWs } = await import('@src/background/service-worker');
    connectLabelerWs();
    await flushPromises();

    expect(MockWebSocket.instances[0]?.url).toContain('cursor=42');
  });

  it('persists the latest received sequence from label frames', async () => {
    const { connectLabelerWs } = await import('@src/background/service-worker');
    connectLabelerWs();
    await flushPromises();

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeTruthy();

    socket!.emitOpen();
    socket!.emitMessage(
      encodeLabelFrame({
        op: 1,
        t: '#labels',
        seq: 77,
        labels: [
          {
            ver: 1,
            src: 'did:plc:m6h36r2hzbnozuhxj4obhkyb',
            uri: 'at://did:plc:alice123/app.bsky.feed.post/3abc',
            val: 'edited',
            cts: '2026-03-31T00:00:00.000Z',
          },
        ],
      }).buffer as ArrayBuffer,
    );
    await flushPromises();

    expect(globalThis.browser.storage.local.set).toHaveBeenCalledWith({ labelerCursor: 77 });
  });

  it('resets and persists reconnect backoff to minimum after a successful connection', async () => {
    await globalThis.browser.storage.local.set({ [LABELER_BACKOFF_STORAGE_KEY]: 60_000 });

    const { connectLabelerWs } = await import('@src/background/service-worker');
    connectLabelerWs();
    await flushPromises();

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeTruthy();

    socket!.emitOpen();
    await flushPromises();

    expect(globalThis.browser.storage.local.set).toHaveBeenCalledWith({ [LABELER_BACKOFF_STORAGE_KEY]: 2_000 });
  });
});
