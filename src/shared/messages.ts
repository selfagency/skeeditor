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

// ── Discriminated union of all inbound requests ───────────────────────────────

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
  | GetPdsUrlRequest;

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
export function sendMessage<T extends MessageRequest>(request: T): Promise<ResponseFor<T>> {
  return browser.runtime.sendMessage(request) as Promise<ResponseFor<T>>;
}
