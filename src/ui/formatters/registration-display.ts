import type { RoleIntent, RegistrationSessionStatusResponse } from '../../api/types.js';
import { ROLE_INTENTS } from '../../config/constants.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';

export function formatGameLabel(game: SupportedGame): string {
  return game === 'civ6' ? 'Civilization VI' : 'Civilization VII';
}

export function formatDiscordAccount(input: {
  discordId: string;
  displayName?: string | null;
  username?: string | null;
}): string {
  const lines: string[] = [];
  if (input.displayName?.trim()) {
    lines.push(`Display name: **${escapeMarkdownLite(input.displayName.trim())}**`);
  }
  if (input.username?.trim()) {
    lines.push(`Username: **${escapeMarkdownLite(input.username.trim())}**`);
  }
  lines.push(`Discord ID: \`${input.discordId}\``);
  return lines.join('\n');
}

export function formatSteamAccount(input: {
  steamId: string;
  steamName?: string | null;
}): string {
  const lines: string[] = [];
  if (input.steamName?.trim()) {
    lines.push(`Username: **${escapeMarkdownLite(input.steamName.trim())}**`);
  }
  lines.push(`Steam ID: \`${input.steamId}\``);
  return lines.join('\n');
}

export function formatAppliedRoleUpdates(intents: readonly RoleIntent[]): string {
  const lines = intents.map((intent) => roleUpdateLine(intent));
  return lines.join('\n') || 'No Discord role changes were required.';
}

export function extractAuthenticationSnapshot(status: RegistrationSessionStatusResponse): {
  username: string;
  displayName: string;
  locale: string;
  verified: string;
  mfaEnabled: string;
  steamName: string;
  steamId: string;
} {
  return {
    username: status.oauth_username_snapshot ?? 'Unknown',
    displayName: status.oauth_display_name_snapshot ?? 'Unknown',
    locale: status.oauth_locale ?? 'Unknown',
    verified: status.oauth_verified == null ? 'Unknown' : status.oauth_verified ? 'Yes' : 'No',
    mfaEnabled: status.oauth_mfa_enabled == null ? 'Unknown' : status.oauth_mfa_enabled ? 'Enabled' : 'Disabled',
    steamName: status.linked_account_name?.trim() || 'Unknown',
    steamId: status.linked_account_id ?? 'Unknown',
  };
}

function roleUpdateLine(intent: RoleIntent): string {
  switch (intent) {
    case ROLE_INTENTS.grantCiv6Rank:
      return `• Added <@&${config.discord.roles.civ6Rank}>`;
    case ROLE_INTENTS.grantCiv7Rank:
      return `• Added <@&${config.discord.roles.civ7Rank}>`;
    case ROLE_INTENTS.grantNovice:
      return `• Added <@&${config.discord.roles.novice}>`;
    case ROLE_INTENTS.removeNonVerified:
      return `• Removed <@&${config.discord.roles.nonVerified}>`;
    default:
      return `• ${intent}`;
  }
}

function escapeMarkdownLite(value: string): string {
  return value.replace(/([\\*_`~|])/g, '\\$1');
}
