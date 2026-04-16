# Skeeditor Privacy Policy

**Effective date:** April 16, 2026

This file is the packaged/distribution copy of Skeeditor’s privacy policy.
The online version is published at `docs/legal/privacy-policy.md` in this repository and on the docs site.

## 1. Who we are

Skeeditor is an open-source browser extension for editing your own Bluesky posts.

## 2. Scope

This policy applies to:

- the Skeeditor extension running in your browser; and
- extension-related service endpoints explicitly used by extension features.

## 3. Information processed by the extension

Skeeditor does not operate an analytics or advertising data pipeline. The extension does process limited data required for core functionality.

### 3.1 Information stored locally in your browser

Skeeditor stores the following in extension storage (`browser.storage.local`):

- OAuth access and refresh tokens, account identifiers, and account selection state
- per-account service configuration (for example, PDS URL)
- extension settings (for example, edit time limit and save strategy)
- pending labeler prompt state
- DPoP key material used for OAuth proof-of-possession

### 3.2 Information transmitted over the network

To provide extension features, Skeeditor transmits data to:

- Bluesky OAuth and AT Protocol endpoints (authorization, token exchange/refresh, record read/write)
- Skeeditor labeler endpoints (label emit and label subscription websocket)
- Slingshot read-acceleration endpoint for public record lookup in specific flows
- DID/profile resolution endpoints (`plc.directory`, `api.bsky.app`, `public.api.bsky.app`)
- Skeeditor documentation-hosted OAuth metadata/callback pages

When labeler emit is active, Skeeditor may send your OAuth access token in an authorization header to permit labeler-side identity verification. Skeeditor does not send refresh tokens to the labeler.

## 4. What we do not do

Skeeditor does not:

- run telemetry, analytics, ad-tech trackers, or crash-reporting pipelines
- sell personal information
- broker or rent user data
- use extension data for personalized advertising

## 5. Purpose of processing

Data is processed only to provide extension functionality, including authentication, account/session management, post editing, conflict handling, and optional labeler-related behavior.

## 6. Data sharing and disclosure

Skeeditor does not share data with data brokers or advertising networks. Data is transmitted only as required to provide extension features, comply with legal obligations, or protect service security and integrity.

## 7. Retention and deletion

Skeeditor data is retained in your browser extension storage until you remove accounts, clear extension data, or uninstall the extension.

## 8. Security

Skeeditor uses HTTPS/WSS for network transport and follows OAuth 2.0 + PKCE and DPoP patterns for authentication flows.

## 9. Changes to this policy

We may update this policy from time to time. Material changes will be reflected by updating the effective date.

## 10. Contact

For privacy questions or requests, use:

- [GitHub Issues](https://github.com/selfagency/skeeditor/issues)
