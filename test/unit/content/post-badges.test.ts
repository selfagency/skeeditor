import { describe, expect, it } from 'vitest';

import { markPostAsEdited } from '@src/content/post-badges';

describe('post-badges', () => {
  it('should add a visible edited badge once', () => {
    document.body.innerHTML = `
      <article>
        <div data-testid="postButtonInline"></div>
      </article>
    `;

    const article = document.querySelector('article');

    expect(article).toBeTruthy();

    markPostAsEdited(article as HTMLElement);
    markPostAsEdited(article as HTMLElement);

    expect(article?.querySelectorAll('[data-skeeditor-edited-badge]')).toHaveLength(1);
    expect(article?.textContent).toContain('Edited');
  });
});
