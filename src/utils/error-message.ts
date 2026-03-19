import { ApiError } from '../api/errors.js';
import { EMOJIS } from '../config/constants.js';

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'BACKEND_UNAVAILABLE':
      case 'BACKEND_TIMEOUT':
        return `${EMOJIS.warning} The auth service is temporarily unavailable. Please try again shortly.`;
      case 'AUTH_SESSION_EXPIRED':
      case 'SESSION_EXPIRED':
        return `${EMOJIS.warning} Your registration session expired. Start the flow again with /register register.`;
      case 'STEAM_OWNERSHIP_FAILED':
      case 'STEAM_PLAYTIME_FAILED':
        return `${EMOJIS.error} Steam validation failed for that game.`;
      case 'DUPLICATE_DISCORD_ID':
      case 'DUPLICATE_STEAM_ID':
      case 'USER_ALREADY_REGISTERED':
        return `${EMOJIS.warning} An account already exists for this Discord or Steam identity.`;
      case 'ROLE_SYNC_FORBIDDEN':
        return `${EMOJIS.error} I cannot assign the required Discord roles. Please contact a moderator.`;
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
