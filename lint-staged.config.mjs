export default {
  '**/*.{cjs,css,html,js,json,md,mjs,ts,yaml,yml}': files => [
    `./node_modules/.bin/task precommit -- ${files.join(' ')}`,
  ],
};
