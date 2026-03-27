export default {
  '**/*.{ts,js}': files => [`oxlint --fix ${files.join(' ')}`, `oxfmt ${files.join(' ')} --write`],
  '!(.beans|.vscode)/**/*.{json,yaml,yml}': files => {
    const filtered = files.filter(f => !f.includes('/.beans/') && !f.includes('/.vscode/'));
    return filtered.length > 0 ? [`oxfmt ${filtered.join(' ')} --write`] : [];
  },
};
