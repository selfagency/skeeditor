export default {
  '**/*.{ts,js}': files => [`oxlint --fix ${files.join(' ')}`, `oxfmt ${files.join(' ')} --write`],
  '**/*.{json,md,yaml,yml}': files => `oxfmt ${files.join(' ')} --write`,
};
