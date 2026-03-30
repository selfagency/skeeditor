import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const FORCE_SAVE_PATTERN = /force(?:\s|[-‐‑‒–—―])+save/i;
const COMPARE_RETRY_PATTERN = /compare\s*(?:\/|and)\s*retry(?:\s+ui)?/i;

const readDoc = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('conflict docs alignment', () => {
  it('does not promise force-save actions in end-user docs', () => {
    const usageGuide = readDoc('docs/guide/usage.md');
    const faqGuide = readDoc('docs/guide/faq.md');

    expect(usageGuide).not.toMatch(FORCE_SAVE_PATTERN);
    expect(faqGuide).not.toMatch(FORCE_SAVE_PATTERN);
  });

  it('does not claim compare/retry conflict UI as implemented modal behavior', () => {
    const conflictDevDoc = readDoc('docs/dev/conflicts.md');
    const putRecordConflictDoc = readDoc('docs/putrecord-conflict-handling.md');

    expect(conflictDevDoc).not.toMatch(/offer\s+\*\*reload\*\*\s*\([^)]*\)\s*or\s*\*\*force(?:\s|[-‐‑‒–—―])+save\*\*/i);
    expect(conflictDevDoc).not.toMatch(COMPARE_RETRY_PATTERN);
    expect(putRecordConflictDoc).not.toMatch(COMPARE_RETRY_PATTERN);
  });
});
