import { describe, expect, it } from 'vitest';

import wxtConfig from '../../../wxt.config';

interface WxtDevServerConfig {
  dev?: {
    server?: {
      origin?: string;
      port?: number;
    };
  };
}

describe('WXT dev server configuration', () => {
  it('moves the WXT watch server off port 3000 so it can coexist with the local devnet', () => {
    const config = wxtConfig as WxtDevServerConfig;

    expect(config.dev?.server?.port).toBe(3001);
  });

  it('keeps the WXT dev server origin aligned with the non-default watch port', () => {
    const config = wxtConfig as WxtDevServerConfig;

    expect(config.dev?.server?.origin).toBe('http://localhost:3001');
  });
});
