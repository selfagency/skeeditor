import { http, HttpResponse } from 'msw';

import { BSKY_APP_ORIGIN } from '../../src/shared/constants';

export const handlers = [
  http.get(`${BSKY_APP_ORIGIN}/xrpc/_health`, () => {
    return HttpResponse.json({ ok: true, service: 'skeeditor' });
  }),
];
