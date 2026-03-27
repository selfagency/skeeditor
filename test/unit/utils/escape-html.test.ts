import { describe, expect, it } from 'vitest';

import { escapeHTML } from '@src/shared/utils/escape-html';

describe('escapeHTML', () => {
  it('should leave safe strings unchanged', () => {
    expect(escapeHTML('hello world')).toBe('hello world');
  });

  it('should escape ampersands', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('should escape less-than', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape double quotes', () => {
    expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHTML("it's fine")).toBe('it&#039;s fine');
  });

  it('should escape all special characters together', () => {
    expect(escapeHTML('<a href="page" title=\'It & They\'>test</a>')).toBe(
      '&lt;a href=&quot;page&quot; title=&#039;It &amp; They&#039;&gt;test&lt;/a&gt;',
    );
  });

  it('should return an empty string unchanged', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('should escape a Bluesky DID that contains special characters', () => {
    expect(escapeHTML('did:plc:alice<>')).toBe('did:plc:alice&lt;&gt;');
  });
});
