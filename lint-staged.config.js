export default {
  '**/*.{ts,js}': files => [`oxlint --fix ${files.join(' ')}`, 'oxfmt . --write'],
  '**/*.{json,md,yaml,yml}': () => 'oxfmt . --write',
};
