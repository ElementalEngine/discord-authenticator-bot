import { ApiError } from '../api/errors.js';
import { EMOJIS } from '../config/constants.js';

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'BACKEND_UNAVAILABLE':
      case 'BACKEND_TIMEOUT':
      case 'HTTP_502':
        return `${EMOJIS.warning} The auth service is temporarily unavailable. Please try again shortly.`;
      case 'REGISTRATION_SESSION_EXPIRED':
      case 'AUTH_SESSION_EXPIRED':
      case 'SESSION_EXPIRED':
        return `${EMOJIS.warning} Your registration session expired. Start again with /register register.`;
      case 'DISCORD_OAUTH_FAILED':
        return `${EMOJIS.warning} Discord authentication could not be completed. Please start again with a fresh registration session.`;
      case 'DISCORD_LINKED_ACCOUNT_NOT_FOUND':
        return `${EMOJIS.warning} No Steam account was found in your Discord linked accounts. Check Discord Settings → Connections and try again.`;
      case 'STEAM_PROFILE_PRIVATE':
        return `${EMOJIS.warning} Your Steam profile must be public and your playtime must be visible before automatic registration can continue.`;
      case 'STEAM_OWNERSHIP_MISSING':
        return `${EMOJIS.warning} Your Steam account does not appear to own the selected game.`;
      case 'STEAM_PLAYTIME_BELOW_THRESHOLD':
        return `${EMOJIS.warning} Your Steam playtime does not meet the registration requirement yet.`;
      case 'STEAM_API_FAILURE':
        return `${EMOJIS.warning} We could not verify your Steam account right now. Please try again shortly.`;
      case 'ALREADY_REGISTERED':
        return `${EMOJIS.info} You are already registered for that game.`;
      case 'DISCORD_ID_CONFLICT':
      case 'STEAM_ID_CONFLICT':
        return `${EMOJIS.warning} This Discord or Steam account is already linked to another registration. Please contact staff if that is wrong.`;
      case 'ROLE_SYNC_FORBIDDEN':
        return `${EMOJIS.error} I cannot update the required Discord roles. Please contact a moderator.`;
      case 'ROLE_SYNC_CONFIG_ERROR':
        return `${EMOJIS.error} Registration completed, but the bot's role configuration needs staff attention.`;
      case 'EPIC_MANUAL_REQUIRED':
      case 'XBOX_MANUAL_REQUIRED':
        return `${EMOJIS.info} Automatic registration is not available for that linked account type. Please contact staff for manual help.`;
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
    const detailSuffix = error.correlationId ? ` [${error.correlationId}]` : '';
    return `${error.code} (${error.status})${detailSuffix}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}
