import browser from 'webextension-polyfill';

import type { GetRecordResult, PutRecordConflictDetails, PutRecordWithSwapError } from './api/xrpc-client';

// ── Auth messages ─────────────────────────────────────────────────────────────

export interface AuthSignInRequest {
  type: 'AUTH_SIGN_IN';
}

export interface AuthSignOutRequest {
  type: 'AUTH_SIGN_OUT';
}

export interface AuthReauthorizeRequest {
  type: 'AUTH_REAUTHORIZE';
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
export type AuthAuthenticatedStatus = { authenticated: true; did: string; expiresAt: number };
export type AuthGetStatusResponse = AuthUnauthenticatedStatus | AuthAuthenticatedStatus;

export interface OkResponse {
  ok: true;
}

export type AuthCallbackResponse = OkResponse | { error: string };

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

// ── Discriminated union of all inbound requests ───────────────────────────────

export type MessageRequest =
  | AuthSignInRequest
  | AuthSignOutRequest
  | AuthReauthorizeRequest
  | AuthGetStatusRequest
  | AuthCallbackRequest
  | GetRecordRequest
  | PutRecordRequest;

// ── Conditional response type — maps each request to its expected response ────

export type ResponseFor<T extends MessageRequest> = T extends AuthGetStatusRequest
  ? AuthGetStatusResponse
  : T extends AuthCallbackRequest
    ? AuthCallbackResponse
    : T extends AuthSignInRequest | AuthSignOutRequest | AuthReauthorizeRequest
      ? OkResponse
      : T extends GetRecordRequest
        ? GetRecordResponse
        : T extends PutRecordRequest
          ? PutRecordResponse
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
