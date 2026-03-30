export default {
  '**/*.{ts,js,mjs,cjs,json,md,yaml,yml}': files => [`./node_modules/.bin/task precommit -- ${files.join(' ')}`],
};
