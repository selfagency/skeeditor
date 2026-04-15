import { describe, expect, it } from 'vitest';

import { BroadcastHub } from '../src/hub.ts';

type StoredLabel = {
  seq: number;
  label: Record<string, unknown>;
};

class FakeStorage {
  public readonly map = new Map<string, StoredLabel>();
  public listCalls = 0;

  async put<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value as StoredLabel);
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      for (const k of key) this.map.delete(k);
      return;
    }
    this.map.delete(key);
  }

  async list<T>(): Promise<Map<string, T>> {
    this.listCalls += 1;
    const entries = [...this.map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return new Map(entries) as Map<string, T>;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
}

const makeLabel = (seq: number): Record<string, unknown> => ({
  ver: 1,
  src: 'did:plc:m6h36r2hzbnozuhxj4obhkyb',
  uri: `at://did:plc:test/app.bsky.feed.post/${seq}`,
  val: 'edited',
  cts: '2026-01-01T00:00:00.000Z',
});

describe('BroadcastHub ring buffer', () => {
  it('evicts deterministically without listing all keys on each append', async () => {
    const storage = new FakeStorage();
    const state = {
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
    } as unknown as DurableObjectState;

    const hub = new BroadcastHub(state, {} as never);

    for (let seq = 1; seq <= 1005; seq += 1) {
      await (
        hub as unknown as { appendToRing: (seq: number, label: Record<string, unknown>) => Promise<void> }
      ).appendToRing(seq, makeLabel(seq));
    }

    expect(storage.listCalls).toBe(0);
    expect(storage.map.size).toBeLessThanOrEqual(1000);
    expect(storage.map.has('label:0000000001')).toBe(false);
    expect(storage.map.has('label:0000000006')).toBe(true);
    expect(storage.map.has('label:0000001005')).toBe(true);
  });
});
