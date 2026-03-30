import { describe, expect, it } from 'vitest';

// @ts-expect-error -- lint-staged config is an untyped ESM module imported for config verification.
import config, { OXFMT_STAGED_COMMAND, OXLINT_STAGED_COMMAND } from '../../../lint-staged.config.mjs';

describe('lint-staged config', () => {
  it('formats staged files directly with oxfmt using the unmatched-pattern guard recommended for hooks', () => {
    expect(OXFMT_STAGED_COMMAND).toBe('./node_modules/.bin/oxfmt --no-error-on-unmatched-pattern');
    expect(config['*']).toBe(OXFMT_STAGED_COMMAND);
  });

  it('lints staged JS and TS files directly with oxlint instead of routing through task precommit', () => {
    expect(OXLINT_STAGED_COMMAND).toBe('./node_modules/.bin/oxlint');
    expect(config['*.{js,jsx,ts,tsx,mjs,cjs}']).toBe(OXLINT_STAGED_COMMAND);
  });
});
