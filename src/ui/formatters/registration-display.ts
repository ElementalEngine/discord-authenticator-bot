import type {
  DiscordLookupResponse,
  DiscordAccountLookupHit,
  LinkedAccountLookupHit,
  LinkedAccountLookupResponse,
  RegistrationPlatform,
  RoleIntent,
} from '../../api/types.js';
import { ROLE_INTENTS } from '../../config/constants.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';

export function formatGameLabel(game: SupportedGame | string): string {
  if (game === 'civ6') return 'Civilization VI';
  if (game === 'civ7') return 'Civilization VII';
  return game;
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

export function toLookupDiscordFields(account: DiscordLookupResponse): Array<{ name: string; value: string; inline?: boolean }> {
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
      name: `Linked account records (${account.linked_accounts.length})`,
      value: formatLinkedAccountHits(account.linked_accounts),
    },
    {
      name: 'Summary',
      value:
        account.linked_accounts.length > 1
          ? '⚠ Multiple linked account records were found for this Discord account.'
          : account.linked_accounts.length === 1
            ? 'One linked account record was found for this Discord account.'
            : 'No linked account records were found for this Discord account.',
    },
  ];
}

export function toLookupLinkedAccountFields(account: LinkedAccountLookupResponse): Array<{ name: string; value: string; inline?: boolean }> {
  return [
    {
      name: 'Linked account',
      value: formatLinkedAccountBlock({
        platform: account.linked_platform,
        username: account.linked_account_name,
        accountId: account.linked_account_id,
        emptyMessage: 'No linked account details were found.',
      }),
    },
    {
      name: `Discord account hits (${account.discord_accounts.length})`,
      value: formatDiscordAccountHits(account.discord_accounts),
    },
    {
      name: 'Summary',
      value:
        account.discord_accounts.length > 1
          ? '⚠ Multiple Discord accounts are tied to this linked account.'
          : account.discord_accounts.length === 1
            ? 'One Discord account is tied to this linked account.'
            : 'No Discord accounts are linked to this account.',
    },
  ];
}

function formatLinkedAccountHits(hits: readonly LinkedAccountLookupHit[]): string {
  if (!hits.length) {
    return 'No linked account records found.';
  }

  return hits
    .map((hit, index) => {
      const heading = `${index + 1}. ${formatLinkedAccountHeading(hit.linked_platform)}`;
      return [heading, formatLinkedAccountBlock({
        platform: hit.linked_platform,
        username: hit.linked_account_name,
        accountId: hit.linked_account_id,
      })].join('\n');
    })
    .join('\n\n');
}

function formatDiscordAccountHits(hits: readonly DiscordAccountLookupHit[]): string {
  if (!hits.length) {
    return 'No Discord accounts found.';
  }

  return hits
    .map((hit, index) => [`${index + 1}. Discord account`, formatDiscordAccountBlock({
      displayName: hit.discord_display_name,
      username: hit.discord_username,
      discordId: hit.discord_id,
    })].join('\n'))
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

function formatSearchable(value?: string | null): string {
  return value?.trim() ? `\`${value.trim()}\`` : 'Unknown';
}
