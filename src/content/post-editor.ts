import { buildFacets } from '../shared/utils/facets';

export interface EditablePostRecord extends Record<string, unknown> {
  $type: 'app.bsky.feed.post';
  createdAt: string;
  text: string;
}

export function buildUpdatedPostRecord(currentRecord: EditablePostRecord, text: string): EditablePostRecord {
  const nextRecord: EditablePostRecord = {
    ...currentRecord,
    text,
  };

  const facets = buildFacets(text);
  if (facets.length > 0) {
    nextRecord.facets = facets;
  } else {
    delete nextRecord.facets;
  }

  return nextRecord;
}
