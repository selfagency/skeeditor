import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('chrome platform docs alignment', () => {
  it('does not instruct entrypoints to import the polyfill manually', () => {
    const chromeNotes = readFileSync(resolve(repoRoot, 'src/platform/chrome/index.ts'), 'utf8');

    expect(chromeNotes).toContain('WXT injects the Promise-based `browser` API');
    expect(chromeNotes).not.toContain('Import the polyfill as the first statement in every entry point.');
  });
});
