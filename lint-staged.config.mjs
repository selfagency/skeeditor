export default {
  '**/*.{ts,js}': files => [`oxlint --fix ${files.join(' ')}`, `oxfmt ${files.join(' ')} --write`],
};
