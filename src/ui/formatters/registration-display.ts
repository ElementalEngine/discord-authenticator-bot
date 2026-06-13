import type {
  DiscordLookupResponse,
  DiscordAccountLookupHit,
  LinkedAccountLookupHit,
  LinkedAccountLookupResponse,
  RegistrationPlatform,
  RegistrationSummary,
  RoleIntent,
} from '../../api/types.js';
import { ROLE_INTENTS } from '../../config/constants.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';

const REGISTRATION_METHOD_LABELS: Record<string, string> = {
  oauth_steam_api: 'Steam API Auth',
  admin_steam_family_share: 'Admin Steam Family Share',
  admin_staff_attested: 'Admin staff-attested',
  self_service_2k: 'Civ 7 2K self-service',
  oauth: 'Steam API Auth',
  manual_admin: 'Admin (legacy)',
};

export function formatRegistrationMethodLabel(method?: string | null): string {
  const value = method?.trim();
  if (!value) return 'Unknown';
  return REGISTRATION_METHOD_LABELS[value] ?? value;
}

function formatRegistrationsLine(registrations?: readonly RegistrationSummary[]): string | null {
  if (!registrations || registrations.length === 0) return null;
  return registrations
    .map((entry) => {
      const parts = [`${formatGameLabel(entry.game)} — ${formatRegistrationMethodLabel(entry.method)}`];
      const registeredAtMs = entry.registered_at ? Date.parse(entry.registered_at) : Number.NaN;
      if (Number.isFinite(registeredAtMs)) {
        parts.push(`registered <t:${Math.floor(registeredAtMs / 1000)}:D>`);
      }
      return parts.join(', ');
    })
    .join('\n');
}

export function formatGameLabel(game: SupportedGame | string): string {
  if (game === 'civ6') return 'Civilization VI';
  if (game === 'civ7') return 'Civilization VII';
  return game.replaceAll('_', ' ');
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
    case '2k':
      return '2K account';
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
    case '2k':
      return 'No linked 2K account found.';
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

  const idLabel = linkedAccountIdLabel(input.platform);
  return [
    `Username: ${formatSearchable(input.username)}`,
    `${idLabel}: ${formatSearchable(input.accountId)}`,
  ].join('\n');
}

function linkedAccountIdLabel(platform?: RegistrationPlatform | null): string {
  switch (platform) {
    case 'epic':
      return 'Epic ID';
    case '2k':
      return '2K ID';
    case 'xbox':
      return 'Xbox ID';
    case 'steam':
    default:
      return 'Steam ID';
  }
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
      const lines = [
        heading,
        formatLinkedAccountBlock({
          platform: hit.linked_platform,
          username: hit.linked_account_name,
          accountId: hit.linked_account_id,
        }),
      ];
      const registrationsLine = formatRegistrationsLine(hit.registrations);
      if (registrationsLine) lines.push(`Registrations:\n${registrationsLine}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatDiscordAccountHits(hits: readonly DiscordAccountLookupHit[]): string {
  if (!hits.length) {
    return 'No Discord accounts found.';
  }

  return hits
    .map((hit, index) => {
      const lines = [
        `${index + 1}. Discord account`,
        formatDiscordAccountBlock({
          displayName: hit.discord_display_name,
          username: hit.discord_username,
          discordId: hit.discord_id,
        }),
      ];
      const registrationsLine = formatRegistrationsLine(hit.registrations);
      if (registrationsLine) lines.push(`Registrations:\n${registrationsLine}`);
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

function formatSearchable(value?: string | null): string {
  return value?.trim() ? `\`${value.trim()}\`` : 'Unknown';
}
