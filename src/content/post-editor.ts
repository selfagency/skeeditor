import { l } from '@atproto/lex';
import type { Main as RichtextFacet } from '../lexicons/app/bsky/richtext/facet.defs';
import type { SelfLabels } from '../lexicons/com/atproto/label/defs.defs';

import { buildFacets } from '../shared/utils/facets';
import { byteSlice } from '../shared/utils/text';

// Simple hash function for creating content fingerprints
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `edit-${Math.abs(hash).toString(16).substring(0, 8)}`;
}

import type { Main as ExternalEmbed } from '../lexicons/app/bsky/embed/external.defs';
import type { Main as ImagesEmbed } from '../lexicons/app/bsky/embed/images.defs';
import type { Main as VideoEmbed } from '../lexicons/app/bsky/embed/video.defs';

export interface EditablePostRecord extends Record<string, unknown> {
  $type: 'app.bsky.feed.post';
  createdAt: string;
  text: string;
  facets?: RichtextFacet[];
  labels?: SelfLabels;
  tags?: string[];
  embed?: ExternalEmbed | ImagesEmbed | VideoEmbed;
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

export function buildUpdatedPostRecord(
  currentRecord: EditablePostRecord,
  text: string,
  mediaFiles?: File[],
): EditablePostRecord {
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

  // Add self-label to indicate this post has been edited (dedupe and cap at 8)
  const existingLabels = currentRecord.labels?.values || [];
  const hasEditedLabel = existingLabels.some(label => label.val === 'edited');
  const labelsWithoutEdited = existingLabels.filter(label => label.val !== 'edited');
  const cappedLabels = labelsWithoutEdited.slice(0, 7); // leave room for 'edited'
  nextRecord.labels = {
    $type: 'com.atproto.label.defs#selfLabels',
    values: hasEditedLabel
      ? existingLabels.slice(0, 8)
      : [
          ...cappedLabels,
          {
            $type: 'com.atproto.label.defs#selfLabel',
            val: 'edited',
          },
        ],
  };

  // Store edit history metadata using tags (dedupe and cap at 8)
  const currentContentHash = simpleHash(currentRecord.text);
  const newTag = `skeeditor-edit-${currentContentHash}`;
  const existingTags = (currentRecord.tags || []).filter(tag => tag !== newTag);
  nextRecord.tags = [...existingTags, newTag].slice(-8);

  // Override embed with new media if provided; otherwise preserve the existing embed from currentRecord
  if (mediaFiles && mediaFiles.length > 0) {
    nextRecord.embed = buildMediaEmbed(mediaFiles);
  }

  return nextRecord;
}

function buildMediaEmbed(mediaFiles: File[]): ImagesEmbed | VideoEmbed {
  const imageFiles = mediaFiles.filter(file => file.type.startsWith('image/'));
  const videoFiles = mediaFiles.filter(file => file.type.startsWith('video/'));

  if (imageFiles.length > 0) {
    const placeholder = {} as unknown as l.BlobRef;
    return {
      $type: 'app.bsky.embed.images',
      images: imageFiles.map(file => ({
        alt: file.name,
        image: placeholder, // Will be filled after upload
      })),
    };
  }

  if (videoFiles.length > 0) {
    const videoFile = videoFiles[0];
    if (!videoFile) throw new Error('No video file found');
    const placeholder = {} as unknown as l.BlobRef;
    return {
      $type: 'app.bsky.embed.video',
      alt: videoFile.name,
      video: placeholder, // Will be filled after upload
    };
  }

  throw new Error('No valid media files found');
}
