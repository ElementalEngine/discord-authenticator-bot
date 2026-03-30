import type {
  AccountLookupResponse,
  AccountRegistrationRecord,
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

export function formatRegistrationLines(
  registrations: Partial<Record<SupportedGame, AccountRegistrationRecord>>,
): string {
  const lines = (Object.entries(registrations) as Array<[SupportedGame, AccountRegistrationRecord | undefined]>)
    .map(([game, value]) => {
      if (!value) return null;
      return `• ${formatGameLabel(game)} — ${value.status} (${value.method})`;
    })
    .filter((value): value is string => Boolean(value));

  return lines.length ? lines.join('\n') : 'No registrations found.';
}

export function toLookupDiscordFields(account: AccountLookupResponse): Array<{ name: string; value: string; inline?: boolean }> {
  const platform = account.linked_platform ?? (account.steam_id ? 'steam' : null);
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
      name: `Linked ${formatLinkedAccountHeading(platform)}`,
      value: formatLinkedAccountBlock({
        platform,
        username: account.linked_account_name ?? account.steam_name,
        accountId: account.linked_account_id ?? account.steam_id,
        emptyMessage: formatLinkedAccountEmpty(platform),
      }),
    },
    {
      name: 'Registrations',
      value: formatRegistrationLines(account.registrations),
    },
  ];
}

export function toLookupSteamFields(account: AccountLookupResponse): Array<{ name: string; value: string; inline?: boolean }> {
  const platform = account.linked_platform ?? (account.steam_id ? 'steam' : null);
  return [
    {
      name: formatLinkedAccountHeading(platform),
      value: formatLinkedAccountBlock({
        platform,
        username: account.linked_account_name ?? account.steam_name,
        accountId: account.linked_account_id ?? account.steam_id,
        emptyMessage: 'No linked account found.',
      }),
    },
    {
      name: 'Linked Discord account',
      value: account.discord_id
        ? formatDiscordAccountBlock({
            displayName: account.discord_display_name,
            username: account.discord_username,
            discordId: account.discord_id,
          })
        : 'No linked Discord account found.',
    },
    {
      name: 'Registrations',
      value: formatRegistrationLines(account.registrations),
    },
  ];
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
