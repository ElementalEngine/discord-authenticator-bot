import { ApiError } from '../api/errors.js';
import { EMOJIS } from '../config/constants.js';

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'BACKEND_UNAVAILABLE':
      case 'BACKEND_TIMEOUT':
      case 'AUTH_COMPLETE_INTERNAL_ERROR':
      case 'AUTH_CALLBACK_INTERNAL_ERROR':
      case 'STEAM_API_FAILURE':
        return `${EMOJIS.warning} The auth service is temporarily unavailable. Please try again shortly.`;
      case 'REGISTRATION_SESSION_EXPIRED':
      case 'AUTH_SESSION_EXPIRED':
      case 'SESSION_EXPIRED':
        return `${EMOJIS.warning} Your registration session expired. Start the flow again with /register register.`;
      case 'REGISTRATION_SESSION_NOT_FOUND':
        return `${EMOJIS.warning} That registration session is no longer available. Start again with /register register.`;
      case 'REGISTRATION_SESSION_NOT_READY':
        return `${EMOJIS.warning} Registration is still in progress. Please wait for this message to update.`;
      case 'DISCORD_LINKED_ACCOUNT_NOT_FOUND':
        return `${EMOJIS.warning} No linked Steam account was found on your Discord profile. Link Steam in Discord and try again.`;
      case 'DISCORD_OAUTH_FAILED':
        return `${EMOJIS.warning} Discord authentication could not be completed. Please try again.`;
      case 'STEAM_PROFILE_PRIVATE':
        return `${EMOJIS.warning} Your Steam profile must be public and your playtime must be visible before automatic registration can continue.`;
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
        return `${EMOJIS.warning} ${error.message}`;
      case 'ROLE_SYNC_FORBIDDEN':
      case 'ROLE_SYNC_CONFIG_ERROR':
        return `${EMOJIS.error} I cannot update the required Discord roles right now. Please contact staff.`;
      default:
        return `${EMOJIS.error} ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return `${EMOJIS.error} ${error.message}`;
  }

  return `${EMOJIS.error} Something went wrong.`;
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
