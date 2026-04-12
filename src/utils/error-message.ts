import { ApiError } from '../api/errors.js';
import { EMOJIS } from '../config/constants.js';

const EXPECTED_AUTH_CODES = new Set([
  'ACCOUNT_NOT_FOUND',
  'ALREADY_REGISTERED',
  'DISCORD_ID_CONFLICT',
  'DISCORD_LINKED_ACCOUNT_NOT_FOUND',
  'DISCORD_USER_MISMATCH',
  'EPIC_MANUAL_REQUIRED',
  'INVALID_AUTH_STATE',
  'LINKED_ACCOUNT_CONFLICT',
  'RANK_ROLE_NOT_ELIGIBLE',
  'REGISTRATION_OPERATION_NOT_FOUND',
  'REGISTRATION_OPERATION_STATE_CONFLICT',
  'REGISTRATION_SESSION_EXPIRED',
  'REGISTRATION_SESSION_NOT_FOUND',
  'REGISTRATION_SESSION_NOT_READY',
  'SESSION_EXPIRED',
  'STEAM_ID_CONFLICT',
  'STEAM_OWNERSHIP_MISSING',
  'STEAM_PLAYTIME_BELOW_THRESHOLD',
  'STEAM_PROFILE_PRIVATE',
  'XBOX_MANUAL_REQUIRED',
]);

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'BACKEND_UNAVAILABLE':
      case 'BACKEND_TIMEOUT':
      case 'ACCOUNT_LOOKUP_FAILED':
      case 'AUTH_COMPLETE_INTERNAL_ERROR':
      case 'AUTH_CALLBACK_INTERNAL_ERROR':
      case 'DISCORD_LINKED_ACCOUNT_FETCH_FAILED':
      case 'MANUAL_REGISTRATION_FAILED':
      case 'RANK_ROLE_REQUEST_FAILED':
      case 'REGISTRATION_FINALIZE_FAILED':
      case 'REGISTRATION_START_FAILED':
      case 'REGISTRATION_STATUS_FAILED':
      case 'STEAM_API_FAILURE':
        return `${EMOJIS.warning} The auth service is temporarily unavailable. Please try again shortly.`;
      case 'REGISTRATION_SESSION_EXPIRED':
      case 'SESSION_EXPIRED':
        return `${EMOJIS.warning} Your registration session expired. Start the flow again with /register register.`;
      case 'REGISTRATION_SESSION_NOT_FOUND':
        return `${EMOJIS.warning} That registration session is no longer available. Start again with /register register.`;
      case 'REGISTRATION_SESSION_NOT_READY':
        return `${EMOJIS.info} Registration checks are still running. Please wait for this message to update.`;
      case 'DISCORD_LINKED_ACCOUNT_NOT_FOUND':
      case 'STEAM_PROFILE_PRIVATE':
      case 'STEAM_OWNERSHIP_MISSING':
      case 'STEAM_PLAYTIME_BELOW_THRESHOLD':
      case 'ALREADY_REGISTERED':
      case 'STEAM_ID_CONFLICT':
      case 'DISCORD_ID_CONFLICT':
      case 'LINKED_ACCOUNT_CONFLICT':
      case 'RANK_ROLE_NOT_ELIGIBLE':
      case 'ACCOUNT_NOT_FOUND':
      case 'MANUAL_REGISTRATION_INVALID':
      case 'AUTH_MISCONFIGURED':
      case 'AUTH_SERVICE_MISCONFIGURED':
      case 'DISCORD_USER_MISMATCH':
      case 'EPIC_MANUAL_REQUIRED':
      case 'XBOX_MANUAL_REQUIRED':
        return `${EMOJIS.warning} ${error.message}`;
      case 'ROLE_SYNC_FORBIDDEN':
      case 'ROLE_SYNC_CONFIG_ERROR':
        return `${EMOJIS.error} I cannot update the required Discord roles right now. Please contact staff.`;
      default:
        if (error.status >= 500) {
          return `${EMOJIS.warning} The auth service hit an unexpected backend error. Please try again shortly.`;
        }
        return `${EMOJIS.error} ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return `${EMOJIS.error} ${error.message}`;
  }

  return `${EMOJIS.error} Something went wrong.`;
}

export function shouldLogSystemError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (EXPECTED_AUTH_CODES.has(error.code)) {
      return false;
    }
    return error.status >= 500 || error.retryable;
  }
  return true;
}

export function toSystemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return 'Backend request failed unexpectedly.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error.';
}

export function toSystemErrorSummary(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.code} (${error.status})${error.correlationId ? ` [${error.correlationId}]` : ''}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

export function stripLeadingStatusEmoji(message: string): string {
  return message.replace(/^(?:⚠️|❌|✅|ℹ️)\s*/u, '').trim();
}
