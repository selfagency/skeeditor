import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readDoc = (relativePath: string): string => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('conflict docs alignment', () => {
  it('does not promise force-save actions in end-user docs', () => {
    const usageGuide = readDoc('docs/guide/usage.md');
    const faqGuide = readDoc('docs/guide/faq.md');

    expect(usageGuide).not.toMatch(/force\s*save/i);
    expect(faqGuide).not.toMatch(/force\s*save/i);
  });

  it('does not claim compare/retry conflict UI as implemented modal behavior', () => {
    const conflictDevDoc = readDoc('docs/dev/conflicts.md');
    const putRecordConflictDoc = readDoc('docs/putrecord-conflict-handling.md');

    expect(conflictDevDoc).not.toMatch(/offer\s+\*\*reload\*\*\s*\([^)]*\)\s*or\s*\*\*force\s*save\*\*/i);
    expect(conflictDevDoc).not.toMatch(/compare\/retry\s+ui/i);
    expect(putRecordConflictDoc).not.toMatch(/compare\/retry\s+ui/i);
  });
});
