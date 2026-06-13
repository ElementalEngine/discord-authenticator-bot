import { EmbedBuilder } from 'discord.js';
import type {
  DiscordLookupResponse,
  LinkedAccountLookupResponse,
  RegistrationPlatform,
  RoleIntent,
} from '../../api/types.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';
import {
  formatDiscordAccountBlock,
  formatGameLabel,
  formatRoleUpdateLines,
  formatLinkedAccountBlock,
  formatLinkedAccountHeading,
  formatRegistrationMethodLabel,
  toLookupDiscordFields,
  toLookupLinkedAccountFields,
} from '../formatters/registration-display.js';

export function buildRegistrationStartEmbed(input: {
  game: SupportedGame;
  expiresAt: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Welcome to CivPlayers Leagues')
    .setDescription(
      [
        'Registration has started.',
        '',
        'Step 1: Authorize with Discord using the button below.',
        'Step 2: We check your linked account, game ownership, and eligibility.',
        'Step 3: We complete your server registration and update your roles.',
      ].join('\n'),
    )
    .addFields(
      {
        name: 'Before you continue',
        value: [
          '**Link Steam to Discord**',
          'Settings → Connections → Steam → sign in → enable **Display on profile**',
          '',
          '**Make your Steam profile visible enough for checks**',
          'Steam Community → Profile → Edit Profile → Privacy Settings',
          'Set **Game details** to **Public** and make sure playtime is visible',
          '',
          '**Complete the browser step**',
          'Use the button below, finish the browser authorization, then return to this message.',
        ].join('\n'),
      },
      {
        name: 'Registration details',
        value: [
          `Game: **${formatGameLabel(input.game)}**`,
          `Session expires: <t:${Math.floor(new Date(input.expiresAt).getTime() / 1000)}:R>`,
        ].join('\n'),
      },
      {
        name: 'Support',
        value: [
          'If a check fails, this message will explain what happened and what to do next.',
          `Need help? Ask <@&${config.discord.roles.moderator}> in <#${config.discord.channels.welcome}>.`,
        ].join('\n'),
      },
    );
}

export function buildCiv7MethodSelectEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Register for Civilization VII')
    .setDescription(
      [
        'Choose how you want to register for **Civilization VII**:',
        '',
        '**Steam API Auth** — link your Steam account through Discord and verify ownership automatically.',
        '**Manual Register** — register a **2K** account ID yourself (no Steam ownership check).',
      ].join('\n'),
    );
}

export function buildSelfServiceSuccessEmbed(input: {
  game: SupportedGame;
  platform: RegistrationPlatform;
  accountId: string;
  accountName?: string | null;
  discordId: string;
  discordUsername?: string | null;
  discordDisplayName?: string | null;
  roleIntents: readonly RoleIntent[];
  registrationMethod?: string | null;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration completed')
    .setDescription('Your registration is complete.')
    .addFields(
      {
        name: 'Discord account',
        value: formatDiscordAccountBlock({
          displayName: input.discordDisplayName,
          username: input.discordUsername,
          discordId: input.discordId,
        }),
      },
      {
        name: formatLinkedAccountHeading(input.platform),
        value: formatLinkedAccountBlock({ platform: input.platform, username: input.accountName, accountId: input.accountId }),
      },
      { name: 'Game', value: formatGameLabel(input.game) },
      { name: 'Method', value: formatRegistrationMethodLabel(input.registrationMethod ?? 'self_service_2k') },
      { name: 'Discord role updates', value: formatRoleUpdateLines(input.roleIntents) },
    );
}

export function buildRegistrationValidatingEmbed(input: { game: SupportedGame }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration checks in progress')
    .setDescription(
      [
        'Discord authorization is complete.',
        '',
        `We are now checking your linked account and eligibility for **${formatGameLabel(input.game)}**.`,
        'No action is needed right now. This message will update again when the checks finish.',
      ].join('\n'),
    );
}

export function buildRegistrationSuccessEmbed(input: {
  game: SupportedGame;
  steamId: string;
  steamName?: string | null;
  discordId: string;
  discordUsername?: string | null;
  discordDisplayName?: string | null;
  roleIntents: readonly RoleIntent[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration completed')
    .setDescription('Your account has been verified and your registration is complete.')
    .addFields(
      {
        name: 'Discord account',
        value: formatDiscordAccountBlock({
          displayName: input.discordDisplayName,
          username: input.discordUsername,
          discordId: input.discordId,
        }),
      },
      {
        name: 'Steam account',
        value: formatLinkedAccountBlock({ platform: 'steam', username: input.steamName, accountId: input.steamId }),
      },
      { name: 'Game', value: formatGameLabel(input.game) },
      { name: 'Discord role updates', value: formatRoleUpdateLines(input.roleIntents) },
    );
}

export function buildManualRegistrationSuccessEmbed(input: {
  game: SupportedGame;
  platform: RegistrationPlatform;
  accountId: string;
  accountName?: string | null;
  discordId: string;
  discordUsername?: string | null;
  discordDisplayName?: string | null;
  roleIntents: readonly RoleIntent[];
  registrationMethod?: string | null;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Manual registration completed')
    .setDescription('The registration was completed successfully.')
    .addFields(
      {
        name: 'Discord account',
        value: formatDiscordAccountBlock({
          displayName: input.discordDisplayName,
          username: input.discordUsername,
          discordId: input.discordId,
        }),
      },
      {
        name: formatLinkedAccountHeading(input.platform),
        value: formatLinkedAccountBlock({ platform: input.platform, username: input.accountName, accountId: input.accountId }),
      },
      { name: 'Game', value: formatGameLabel(input.game) },
      { name: 'Method', value: formatRegistrationMethodLabel(input.registrationMethod) },
      { name: 'Discord role updates', value: formatRoleUpdateLines(input.roleIntents) },
    );
}

export function buildRankRoleSuccessEmbed(input: {
  game: SupportedGame;
  roleIntents: readonly RoleIntent[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Ranked role updated')
    .setDescription('Your additional ranked role has been updated successfully.')
    .addFields(
      { name: 'Game', value: formatGameLabel(input.game) },
      { name: 'Discord role updates', value: formatRoleUpdateLines(input.roleIntents) },
    );
}

export function buildRegistrationExpiredEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration expired')
    .setDescription('This registration session expired before it could finish. Run `/register civ6` or `/register civ7` to start again.');
}

export function buildRegistrationFailureEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration could not be completed')
    .setDescription(message);
}

export function buildLookupDiscordEmbed(account: DiscordLookupResponse): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Account lookup by Discord ID')
    .addFields(...toLookupDiscordFields(account));
}

export function buildLookupLinkedAccountEmbed(account: LinkedAccountLookupResponse): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Account lookup by linked account ID')
    .addFields(...toLookupLinkedAccountFields(account));
}
