import { describe, expect, it } from 'vitest';

import * as app from '../../../src/lexicons/app';
import * as com from '../../../src/lexicons/com';

describe('generated lexicons', () => {
  it('should expose the installed Bluesky and atproto lexicon namespaces', () => {
    expect(app.bsky.feed.post).toBeDefined();
    expect(com.atproto.repo.putRecord).toBeDefined();
  });
});
