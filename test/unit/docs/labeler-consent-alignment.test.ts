import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readDoc = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('labeler consent docs alignment', () => {
  it('documents a manual subscription flow from the popup prompt', () => {
    const usageGuide = readDoc('docs/guide/usage.md');

    expect(usageGuide).toContain('Open labeler profile');
    expect(usageGuide).toContain('opens Bluesky');
    expect(usageGuide).not.toMatch(/choose\s+\*\*subscribe\*\*\s+to\s+opt\s+in/i);
  });

  it('does not claim the extension auto-subscribes during sign-in', () => {
    const faqGuide = readDoc('docs/guide/faq.md');

    expect(faqGuide).not.toMatch(/subscribe\s+during\s+the\s+initial\s+sign-in\s+flow/i);
  });
});
