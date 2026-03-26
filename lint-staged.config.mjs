export default {
  '**/*.{ts,js}': files => [`oxlint --fix ${files.join(' ')}`, `oxfmt ${files.join(' ')} --write`],
  '!(.beans)/**/*.{json,md,yaml,yml}': files => {
    const filtered = files.filter(f => !f.includes('/.beans/'));
    return filtered.length > 0 ? `oxfmt ${filtered.join(' ')} --write` : 'echo "no files to format"';
  },
};
