import type { Main as RichtextFacet } from '../lexicons/app/bsky/richtext/facet.defs';

import { buildFacets } from '../shared/utils/facets';
import { utf8ByteLength } from '../shared/utils/text';

export interface EditablePostRecord extends Record<string, unknown> {
  $type: 'app.bsky.feed.post';
  createdAt: string;
  text: string;
  facets?: RichtextFacet[];
}

const sliceTextByUtf8ByteRange = (text: string, byteStart: number, byteEnd: number): string => {
  let currentByteOffset = 0;
  let startIndex = -1;
  let endIndex = -1;

  for (const [index, char] of Array.from(text).entries()) {
    const charStart = currentByteOffset;
    const charEnd = charStart + utf8ByteLength(char);

    if (startIndex === -1 && byteStart >= charStart && byteStart < charEnd) {
      startIndex = index;
    }

    if (byteEnd > charStart && byteEnd <= charEnd) {
      endIndex = index + 1;
      break;
    }

    currentByteOffset = charEnd;
  }

  if (startIndex === -1 || endIndex === -1) {
    return '';
  }

  return Array.from(text).slice(startIndex, endIndex).join('');
};

const buildMentionDidResolver = (currentRecord: EditablePostRecord): ((handle: string) => string | undefined) => {
  const mentionDidByHandle = new Map<string, string>();

  for (const facet of currentRecord.facets ?? []) {
    const mentionFeature = facet.features?.find(feature => feature.$type === 'app.bsky.richtext.facet#mention');

    if (!mentionFeature || !('did' in mentionFeature) || typeof mentionFeature.did !== 'string') {
      continue;
    }

    const mentionedText = sliceTextByUtf8ByteRange(currentRecord.text, facet.index.byteStart, facet.index.byteEnd);
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
