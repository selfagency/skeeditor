import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readDoc = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('labeler developer docs alignment', () => {
  it('documents manual popup consent and configurable labeler identity values', () => {
    const devDoc = readDoc('docs/dev/labeler-services.md');

    expect(devDoc).toContain('opens the Bluesky labeler profile');
    expect(devDoc).toContain('LABELER_SERVICE_URL');
    expect(devDoc).toContain('LABELER_PUBLIC_KEY_MULTIBASE');
    expect(devDoc).not.toMatch(/Extension adds LABELER_DID/i);
  });
});
