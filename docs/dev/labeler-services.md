# Labeler Services for skeeditor

Based on the Bluesky moderation documentation, here's what we need to know about implementing labeler services:

## What are Labeler Services?

Labeler services are moderation services that can apply labels to content on the Bluesky network. These labels help users filter and moderate content according to their preferences.

## Key Components

### 1. Labeler Declaration

To become a labeler service, an account must:

- Publish an `app.bsky.labeler.service` record declaring itself as a labeler
- Include policies about what labels they publish
- Specify subject types and collections they handle

Example declaration:

```json
{
  "$type": "app.bsky.labeler.service",
  "policies": {
    "labelValues": ["porn", "spider"],
    "labelValueDefinitions": [
      {
        "identifier": "spider",
        "severity": "alert",
        "blurs": "media",
        "defaultSetting": "warn",
        "locales": [
          {"lang": "en", "name": "Spider Warning", "description": "Spider!!!"}
        ]
      }
    ]
  },
  "subjectTypes": ["record"],
  "subjectCollections": ["app.bsky.feed.post", "app.bsky.actor.profile"],
  "reasonTypes": ["com.atproto.moderation.defs#reasonOther"],
  "createdAt": "2026-03-25T00:00:00.000Z"
}
```

### 2. Label Structure

Labels have this structure:

```typescript
{
  src: string; // DID of the labeler
  uri: string; // AT URI of the labeled content
  cid?: string; // Optional CID for version-specific labeling
  val: string; // Label value (e.g., "edited", "spam")
  neg?: boolean; // Negation flag
  cts: string; // Creation timestamp
}
```

### 3. Label Values

- **Global labels**: Defined by the protocol (e.g., `porn`, `sexual`, `gore`, `bot`)
- **Custom labels**: Defined by individual labelers
- **Special labels**: Start with `!` (e.g., `!hide`, `!warn`, `!no-unauthenticated`)

## Implementation Considerations for skeeditor

### 1. Self-Labeling (Already Implemented)

We've implemented self-labeling for edited posts using the `edited` label. This is the correct approach for our use case.

### 2. Labeler Service Requirements

If we want to create a full labeler service:

1. **Service Declaration**: Publish the `app.bsky.labeler.service` record
2. **Label Publishing**: Implement a labeling service that publishes signed labels
3. **Label Sync**: Users would need to subscribe to our labeler DID
4. **Label Definitions**: Provide clear definitions for any custom labels we create

### 3. User Subscription

Users can subscribe to labelers by setting the `atproto-accept-labelers` HTTP header with a comma-separated list of labeler DIDs.

### 4. Moderation Preferences

Our extension should respect user moderation preferences from `app.bsky.actor.preferences`.

## Current Implementation Status

✅ **Self-labeling for edited posts**: Implemented using the `edited` label
✅ **Label structure**: Follows AT Protocol specifications
❌ **Full labeler service**: Not implemented (would require separate service infrastructure)

## Recommendations

1. **For now**: Continue with self-labeling approach - it's sufficient for our edit tracking needs
2. **Future consideration**: If we want to provide moderation services, we would need to:
   - Set up a separate labeling service
   - Publish labeler declaration
   - Implement label signing and publishing
   - Handle user subscriptions

## Resources

- [Bluesky Moderation Documentation](https://docs.bsky.app/docs/advanced-guides/moderation)
- [AT Protocol Label Specification](https://atproto.com/specs/label)
- [Official TypeScript SDK Moderation APIs](https://github.com/bluesky-social/atproto/tree/main/packages/api)
