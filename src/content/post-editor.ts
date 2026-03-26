import type { Main as RichtextFacet } from '../lexicons/app/bsky/richtext/facet.defs';

import { buildFacets } from '../shared/utils/facets';
import { byteSlice } from '../shared/utils/text';

export interface EditablePostRecord extends Record<string, unknown> {
  $type: 'app.bsky.feed.post';
  createdAt: string;
  text: string;
  facets?: RichtextFacet[];
}

const buildMentionDidResolver = (currentRecord: EditablePostRecord): ((handle: string) => string | undefined) => {
  const mentionDidByHandle = new Map<string, string>();

  for (const facet of currentRecord.facets ?? []) {
    const mentionFeature = facet.features?.find(feature => feature.$type === 'app.bsky.richtext.facet#mention');

    if (!mentionFeature || !('did' in mentionFeature) || typeof mentionFeature.did !== 'string') {
      continue;
    }

    const mentionedText = byteSlice(currentRecord.text, facet.index.byteStart, facet.index.byteEnd);
    const handle = mentionedText.startsWith('@') ? mentionedText.slice(1).toLowerCase() : '';

    if (handle) {
      mentionDidByHandle.set(handle, mentionFeature.did);
    }
  }

  return handle => mentionDidByHandle.get(handle.toLowerCase());
};

export function buildUpdatedPostRecord(currentRecord: EditablePostRecord, text: string): EditablePostRecord {
  const nextRecord: EditablePostRecord = {
    ...currentRecord,
    text,
  };

  const facets = buildFacets(text, { resolveMentionDid: buildMentionDidResolver(currentRecord) });
  if (facets.length > 0) {
    nextRecord.facets = facets;
  } else {
    delete nextRecord.facets;
  }

  return nextRecord;
}
