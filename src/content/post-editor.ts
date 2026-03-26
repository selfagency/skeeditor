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

import type { Main as ImagesEmbed } from '../lexicons/app/bsky/embed/images.defs';
import type { Main as VideoEmbed } from '../lexicons/app/bsky/embed/video.defs';

export interface EditablePostRecord extends Record<string, unknown> {
  $type: 'app.bsky.feed.post';
  createdAt: string;
  text: string;
  facets?: RichtextFacet[];
  labels?: SelfLabels;
  tags?: string[];
  embed?: ImagesEmbed | VideoEmbed;
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

  // Add self-label to indicate this post has been edited
  const existingLabels = currentRecord.labels?.values || [];
  nextRecord.labels = {
    $type: 'com.atproto.label.defs#selfLabels',
    values: [
      ...existingLabels,
      {
        $type: 'com.atproto.label.defs#selfLabel',
        val: 'edited',
      },
    ],
  };

  // Store edit history metadata using tags
  const currentContentHash = simpleHash(currentRecord.text);
  const existingTags = currentRecord.tags || [];
  nextRecord.tags = [...existingTags, `skeeditor-edit-${currentContentHash}`];

  // Handle media embeds if media files are provided
  if (mediaFiles && mediaFiles.length > 0) {
    nextRecord.embed = buildMediaEmbed(mediaFiles);
  } else {
    delete nextRecord.embed;
  }

  return nextRecord;
}

function buildMediaEmbed(mediaFiles: File[]): ImagesEmbed | VideoEmbed {
  const imageFiles = mediaFiles.filter(file => file.type.startsWith('image/'));
  const videoFiles = mediaFiles.filter(file => file.type.startsWith('video/'));

  if (imageFiles.length > 0) {
    return {
      $type: 'app.bsky.embed.images',
      images: imageFiles.map(file => ({
        alt: file.name,
        image: { $link: '' }, // Will be filled after upload
      })),
    };
  }

  if (videoFiles.length > 0) {
    const videoFile = videoFiles[0]; // Only support one video
    return {
      $type: 'app.bsky.embed.video',
      alt: videoFile.name,
      video: { $link: '' }, // Will be filled after upload
    };
  }

  throw new Error('No valid media files found');
}
