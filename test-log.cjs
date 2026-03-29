const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`
    <article data-testid="post" data-at-uri="at://did:plc:testuser00000000000000/app.bsky.feed.post/testpost123456">
      <p data-testid="post-text">Hello from my own post. #testing</p>
    </article>
`);
const document = dom.window.document;
const el = document.querySelector('article');
const q = ['[data-testid="postDetailedText"]', '[data-testid="post-text"]'].join(', ');
const p = el.querySelector(q);
console.log(p.textContent.trim());
