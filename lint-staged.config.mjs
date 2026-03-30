export default {
  '**/*.{ts,js}': files => [
    `./node_modules/.bin/tsc --no-emit`,
    `./node_modules/.bin/vitest run --project unit`,
    `./node_modules/.bin/vitest run --project integration`,
    `./node_modules/.bin/oxlint --fix ${files.join(' ')}`,
    `./node_modules/.bin/oxfmt --write ${files.join(' ')}`
  ],
};
