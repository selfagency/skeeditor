import { l } from '@atproto/lex';
import * as AppBskyFeedPost from '../lexicons/app/bsky/feed/post.defs';
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
  return Math.abs(hash).toString(16).substring(0, 8);
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

interface SafeValidateSuccess<T> {
  success: true;
  value: T;
}

interface SafeValidateFailure {
  error?: string;
  message?: string;
  issues?: Array<{ message?: string }>;
}

const MAX_IMAGE_COUNT = 4;
const MAX_VIDEO_COUNT = 1;

const isSafeValidateSuccess = <T>(value: unknown): value is SafeValidateSuccess<T> => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'success' in value &&
    (value as Record<string, unknown>)['success'] === true &&
    'value' in value
  );
};

const formatValidationFailure = (result: SafeValidateFailure): string => {
  if (typeof result.message === 'string' && result.message.length > 0) {
    return result.message;
  }

  const firstIssue = result.issues?.find(issue => typeof issue.message === 'string' && issue.message.length > 0);
  if (typeof firstIssue?.message === 'string') {
    return firstIssue.message;
  }

  if (typeof result.error === 'string' && result.error.length > 0) {
    return result.error;
  }

  return 'Edited post does not match the Bluesky post schema.';
};

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
  options?: { updateCreatedAt?: boolean },
): EditablePostRecord {
  const nextRecord: EditablePostRecord = {
    ...currentRecord,
    text,
    createdAt: options?.updateCreatedAt === false ? currentRecord.createdAt : new Date().toISOString(),
  };

  const facets = buildFacets(text, { resolveMentionDid: buildMentionDidResolver(currentRecord) });
  if (facets.length > 0) {
    nextRecord.facets = facets;
  } else {
    delete nextRecord.facets;
  }

  // Store edit history metadata using tags (dedupe and cap at 8)
  const currentContentHash = simpleHash(currentRecord.text);
  const newTag = `skeeditor-edit-${currentContentHash}`;
  const existingTags = (currentRecord.tags || []).filter(tag => tag !== newTag);
  nextRecord.tags = [...existingTags, newTag].slice(-8);

  // Override embed with new media if provided; otherwise preserve the existing embed from currentRecord
  if (mediaFiles && mediaFiles.length > 0) {
    nextRecord.embed = buildMediaEmbed(normalizeMediaFiles(mediaFiles));
  }

  return nextRecord;
}

export function validateUpdatedPostRecord(
  record: EditablePostRecord,
): { success: true; value: EditablePostRecord } | { success: false; error: string } {
  const result = AppBskyFeedPost.$safeValidate(record) as SafeValidateSuccess<EditablePostRecord> | SafeValidateFailure;

  if (isSafeValidateSuccess<EditablePostRecord>(result)) {
    return { success: true, value: result.value };
  }

  return {
    success: false,
    error: `Edited post is invalid: ${formatValidationFailure(result)}`,
  };
}

export function normalizeMediaFiles(mediaFiles: File[]): File[] {
  const imageFiles = mediaFiles.filter(file => file.type.startsWith('image/'));
  const videoFiles = mediaFiles.filter(file => file.type.startsWith('video/'));

  if (imageFiles.length > 0 && videoFiles.length > 0) {
    throw new Error('Cannot mix images and video in one post');
  }

  if (imageFiles.length > MAX_IMAGE_COUNT) {
    throw new Error(`You can attach up to ${MAX_IMAGE_COUNT} images`);
  }

  if (videoFiles.length > MAX_VIDEO_COUNT) {
    throw new Error(`You can attach only ${MAX_VIDEO_COUNT} video`);
  }

  if (imageFiles.length > 0) {
    return imageFiles;
  }

  if (videoFiles.length > 0) {
    const firstVideo = videoFiles[0];
    if (!firstVideo) throw new Error('No video file found');
    return [firstVideo];
  }

  throw new Error('No valid media files found');
}

function buildMediaEmbed(mediaFiles: File[]): ImagesEmbed | VideoEmbed {
  const imageFiles = mediaFiles.filter(file => file.type.startsWith('image/'));

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

  if (mediaFiles.length > 0) {
    const videoFile = mediaFiles[0];
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
