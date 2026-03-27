import { browser } from 'wxt/browser';
import type { l } from '@atproto/lex';

import type { GetRecordResult, PutRecordConflictDetails, PutRecordWithSwapError } from './api/xrpc-client';
import type { ExtensionSettings } from './constants';

// ── Auth messages ─────────────────────────────────────────────────────────────

export interface AuthSignInRequest {
  type: 'AUTH_SIGN_IN';
  pdsUrl?: string;
}

export interface AuthSignOutRequest {
  type: 'AUTH_SIGN_OUT';
}

export interface AuthReauthorizeRequest {
  type: 'AUTH_REAUTHORIZE';
  pdsUrl?: string;
}

export interface AuthGetStatusRequest {
  type: 'AUTH_GET_STATUS';
}

export interface AuthCallbackRequest {
  type: 'AUTH_CALLBACK';
  code: string;
  state: string;
}

export type AuthUnauthenticatedStatus = { authenticated: false };
export type AuthAuthenticatedStatus = { authenticated: true; did: string; handle?: string; expiresAt: number };
export type AuthGetStatusResponse = AuthUnauthenticatedStatus | AuthAuthenticatedStatus;

export interface OkResponse {
  ok: true;
}

export type AuthCallbackResponse = OkResponse | { error: string };

// ── Multi-account messages ─────────────────────────────────────────────────────

export interface AuthListAccountsRequest {
  type: 'AUTH_LIST_ACCOUNTS';
}

export interface AuthListAccountsAccount {
  did: string;
  handle?: string;
  expiresAt: number;
  isActive: boolean;
}

export type AuthListAccountsResponse = { accounts: AuthListAccountsAccount[] };

export interface AuthSwitchAccountRequest {
  type: 'AUTH_SWITCH_ACCOUNT';
  did: string;
}

export interface AuthSignOutAccountRequest {
  type: 'AUTH_SIGN_OUT_ACCOUNT';
  did: string;
}

// ── Settings messages ─────────────────────────────────────────────────────────

export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface SetSettingsRequest {
  type: 'SET_SETTINGS';
  settings: ExtensionSettings;
}

export type GetSettingsResponse = ExtensionSettings | { error: string };
export type SetSettingsResponse = OkResponse | { error: string };

// ── Record messages ───────────────────────────────────────────────────────────

export interface GetRecordRequest {
  type: 'GET_RECORD';
  repo: string;
  collection: string;
  rkey: string;
}

export type GetRecordResponse = GetRecordResult | { error: string };

export interface PutRecordSuccessResponse {
  type: 'PUT_RECORD_SUCCESS';
  uri: string;
  cid: string;
}

export interface PutRecordErrorResponse {
  type: 'PUT_RECORD_ERROR';
  message: string;
  /** If true, the error is due to an authentication/permission issue and the user needs to re-authenticate */
  requiresReauth?: boolean;
}

export interface PutRecordConflictResponse {
  type: 'PUT_RECORD_CONFLICT';
  error: PutRecordWithSwapError;
  conflict?: PutRecordConflictDetails;
}

export interface PutRecordRequest {
  type: 'PUT_RECORD';
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown> & { $type: string };
  swapRecord?: string;
}

export type PutRecordResponse = PutRecordSuccessResponse | PutRecordErrorResponse | PutRecordConflictResponse;

// ── Blob upload messages ────────────────────────────────────────────────────────

export interface UploadBlobRequest {
  type: 'UPLOAD_BLOB';
  data: Blob | File;
  repo: string;
}

export interface UploadBlobSuccessResponse {
  blobRef: l.BlobRef;
  mimeType: string;
}

export interface UploadBlobErrorResponse {
  error: string;
}

export type UploadBlobResponse = UploadBlobSuccessResponse | UploadBlobErrorResponse;

// ── Labeler subscription messages ──────────────────────────────────────────────

/**
 * Sent after a successful AUTH_CALLBACK to check whether the user has already
 * subscribed to the skeeditor labeler. If not, triggers the consent prompt in
 * the popup. Fails silently — a network error must never block sign-in.
 */
export interface CheckLabelerSubscriptionRequest {
  type: 'CHECK_LABELER_SUBSCRIPTION';
}

export type CheckLabelerSubscriptionResponse = OkResponse | { error: string };

// ── Discriminated union of all inbound requests ─────────────────────────────────

export type MessageRequest =
  | AuthSignInRequest
  | AuthSignOutRequest
  | AuthReauthorizeRequest
  | AuthGetStatusRequest
  | AuthCallbackRequest
  | AuthListAccountsRequest
  | AuthSwitchAccountRequest
  | AuthSignOutAccountRequest
  | GetSettingsRequest
  | SetSettingsRequest
  | GetRecordRequest
  | PutRecordRequest
  | UploadBlobRequest
  | SetPdsUrlRequest
  | GetPdsUrlRequest
  | CheckLabelerSubscriptionRequest;

// ── PDS URL messages ─────────────────────────────────────────────────────────

export interface SetPdsUrlRequest {
  type: 'SET_PDS_URL';
  url: string;
}

export interface GetPdsUrlRequest {
  type: 'GET_PDS_URL';
}

export type SetPdsUrlResponse = OkResponse | { error: string };
export type GetPdsUrlResponse = { url: string } | { error: string };

// ── Conditional response type — maps each request to its expected response ────

export type ResponseFor<T extends MessageRequest> = T extends AuthGetStatusRequest
  ? AuthGetStatusResponse
  : T extends AuthCallbackRequest
    ? AuthCallbackResponse
    : T extends AuthListAccountsRequest
      ? AuthListAccountsResponse
      : T extends GetSettingsRequest
        ? GetSettingsResponse
        : T extends SetSettingsRequest
          ? SetSettingsResponse
          : T extends
                | AuthSignInRequest
                | AuthSignOutRequest
                | AuthReauthorizeRequest
                | AuthSwitchAccountRequest
                | AuthSignOutAccountRequest
            ? OkResponse
            : T extends GetRecordRequest
              ? GetRecordResponse
              : T extends PutRecordRequest
                ? PutRecordResponse
                : T extends UploadBlobRequest
                  ? UploadBlobResponse
                  : T extends SetPdsUrlRequest
                    ? SetPdsUrlResponse
                    : T extends GetPdsUrlRequest
                      ? GetPdsUrlResponse
                      : T extends CheckLabelerSubscriptionRequest
                        ? CheckLabelerSubscriptionResponse
                        : never;

/**
 * Type-safe wrapper around `browser.runtime.sendMessage`.
 *
 * The return type is narrowed to the response expected for the given request
 * variant, providing compile-time safety for callers (Web Components, content
 * scripts, popup).
 *
 * Must only be called from contexts that have access to the extension runtime
 * (popup, content scripts, options page — NOT from page-level JavaScript).
 */
export async function sendMessage<T extends MessageRequest>(
  request: T,
  { maxAttempts = 8, retryDelayMs = 300 }: { maxAttempts?: number; retryDelayMs?: number } = {},
): Promise<ResponseFor<T>> {
  // In MV3 the service worker may be starting up when the content script first
  // sends a message, causing chrome.runtime.sendMessage to resolve to undefined
  // instead of waiting for the listener.  Retry with backoff so the SW has time
  // to register its onMessage handler.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: unknown;
    try {
      response = await browser.runtime.sendMessage(request);
    } catch (err) {
      // "Extension context invalidated" means the extension was reloaded while
      // this content script was still running in the tab.  There is no recovery
      // path — propagate so the caller can handle it gracefully.
      throw err;
    }
    if (response !== undefined) {
      return response as ResponseFor<T>;
    }
    if (attempt < maxAttempts) {
      await new Promise<void>(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  throw new Error('No response from background service worker — it may have crashed or not yet started.');
}
