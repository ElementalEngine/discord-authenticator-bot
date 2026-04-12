import type {
  DiscordLookupResponse,
  LinkedAccountLookupHit,
  LinkedAccountLookupResponse,
  RegistrationPlatform,
  RoleIntent,
} from '../../api/types.js';
import { ROLE_INTENTS } from '../../config/constants.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';

export function formatGameLabel(game: SupportedGame): string {
  return game === 'civ6' ? 'Civilization VI' : 'Civilization VII';
}

export function formatDiscordAccountBlock(input: {
  displayName?: string | null;
  username?: string | null;
  discordId: string;
}): string {
  return [
    `Display name: ${input.displayName?.trim() || 'Unknown'}`,
    `Username: ${formatSearchable(input.username)}`,
    `Discord ID: ${formatSearchable(input.discordId)}`,
  ].join('\n');
}

export function formatLinkedAccountHeading(platform?: RegistrationPlatform | null): string {
  switch (platform) {
    case 'epic':
      return 'Epic account';
    case 'xbox':
      return 'Xbox account';
    case 'steam':
    default:
      return 'Steam account';
  }
}

export function formatLinkedAccountEmpty(platform?: RegistrationPlatform | null): string {
  switch (platform) {
    case 'epic':
      return 'No linked Epic account found.';
    case 'xbox':
      return 'No linked Xbox account found.';
    case 'steam':
    default:
      return 'No linked Steam account found.';
  }
}

export function formatLinkedAccountBlock(input: {
  platform?: RegistrationPlatform | null;
  username?: string | null;
  accountId?: string | null;
  emptyMessage?: string;
}): string {
  if (!input.accountId) {
    return input.emptyMessage ?? formatLinkedAccountEmpty(input.platform);
  }

  const idLabel = input.platform === 'epic' ? 'Epic ID' : input.platform === 'xbox' ? 'Xbox ID' : 'Steam ID';
  return [
    `Username: ${formatSearchable(input.username)}`,
    `${idLabel}: ${formatSearchable(input.accountId)}`,
  ].join('\n');
}

export function formatRoleUpdateLines(intents: readonly RoleIntent[]): string {
  if (!intents.length) return 'No Discord role changes were required.';
  return intents.map((intent) => `• ${roleUpdateLabel(intent)}`).join('\n');
}

export function formatLookupSummary(input: { label: string; count: number; multipleWarning: string }): string {
  if (input.count > 1) {
    return `${input.label}: ${input.count}\n⚠ ${input.multipleWarning}`;
  }
  return `${input.label}: ${input.count}`;
}

export function toDiscordLookupFields(
  account: DiscordLookupResponse,
): Array<{ name: string; value: string; inline?: boolean }> {
  return [
    {
      name: 'Discord account',
      value: formatDiscordAccountBlock({
        displayName: account.discord_display_name,
        username: account.discord_username,
        discordId: account.discord_id,
      }),
    },
    {
      name: linkedAccountFieldTitle(account.linked_accounts.length),
      value: formatLinkedAccountHitLines(account.linked_accounts),
    },
  ];
}

export function toLinkedAccountLookupFields(
  account: LinkedAccountLookupResponse,
): Array<{ name: string; value: string; inline?: boolean }> {
  return [
    {
      name: 'Linked account',
      value: formatLinkedAccountLookupHeader(account),
    },
    {
      name: discordAccountFieldTitle(account.discord_accounts.length),
      value: formatLinkedDiscordHitLines(account),
    },
  ];
}

function linkedAccountFieldTitle(count: number): string {
  return count === 1 ? 'Linked account record (1)' : `Linked account records (${count})`;
}

function discordAccountFieldTitle(count: number): string {
  return count === 1 ? 'Discord account hit (1)' : `Discord account hits (${count})`;
}

function formatLinkedAccountHitLines(records: readonly LinkedAccountLookupHit[]): string {
  if (!records.length) {
    return 'No linked account records found for this Discord account.';
  }

  return records
    .map((record, index) => {
      const lines = [
        `${index + 1}. Linked account`,
        `Platform: ${formatSearchable(record.linked_platform ?? null)}`,
        `Account ID: ${formatSearchable(record.linked_account_id)}`,
        `Account name: ${formatSearchable(record.linked_account_name)}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatLinkedAccountLookupHeader(account: LinkedAccountLookupResponse): string {
  return [
    `Linked account ID: ${formatSearchable(account.linked_account_id)}`,
    `Linked account name: ${formatSearchable(account.linked_account_name)}`,
    `Linked platform: ${formatSearchable(account.linked_platform ?? null)}`,
  ].join('\n');
}

function formatLinkedDiscordHitLines(account: LinkedAccountLookupResponse): string {
  if (!account.discord_accounts.length) {
    return 'No Discord accounts are linked to this account.';
  }

  return account.discord_accounts
    .map((hit, index) => {
      const lines = [
        `${index + 1}. Discord account`,
        `Discord ID: ${formatSearchable(hit.discord_id)}`,
        `Discord username: ${formatSearchable(hit.discord_username)}`,
      ];
      if (hit.discord_display_name?.trim()) {
        lines.push(`Display name: ${formatSearchable(hit.discord_display_name)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function roleUpdateLabel(intent: RoleIntent): string {
  switch (intent) {
    case ROLE_INTENTS.grantCiv6Rank:
      return `Added <@&${config.discord.roles.civ6Rank}>`;
    case ROLE_INTENTS.grantCiv7Rank:
      return `Added <@&${config.discord.roles.civ7Rank}>`;
    case ROLE_INTENTS.grantNovice:
      return `Added <@&${config.discord.roles.novice}>`;
    case ROLE_INTENTS.removeNonVerified:
      return `Removed <@&${config.discord.roles.nonVerified}>`;
    default:
      return intent;
  }
}

function formatSearchable(value?: string | RegistrationPlatform | null): string {
  return typeof value === 'string' && value.trim() ? `\`${value.trim()}\`` : 'Unknown';
}
