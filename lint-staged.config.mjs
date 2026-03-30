export const OXFMT_STAGED_COMMAND = './node_modules/.bin/oxfmt --no-error-on-unmatched-pattern';
export const OXLINT_STAGED_COMMAND = './node_modules/.bin/oxlint';

export default {
  '*': OXFMT_STAGED_COMMAND,
  '*.{js,jsx,ts,tsx,mjs,cjs}': OXLINT_STAGED_COMMAND,
};
