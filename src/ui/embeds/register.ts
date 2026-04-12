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
  formatLookupSummary,
  formatRoleUpdateLines,
  formatLinkedAccountBlock,
  formatLinkedAccountHeading,
  toDiscordLookupFields,
  toLinkedAccountLookupFields,
} from '../formatters/registration-display.js';

export function buildRegistrationStartEmbed(input: {
  game: SupportedGame;
  expiresAt: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Welcome to CivPlayers Leagues')
    .setDescription(
      [
        'Read the server rules and Discord’s **Terms of Service**, **Community Guidelines**, and **Partner Code of Conduct** before you continue.',
        '',
        'Use **Start Discord verification** below to begin Discord + Steam verification. This message updates automatically when the checks finish, showing either a clear confirmation or the reason registration could not be completed.',
      ].join('\n'),
    )
    .addFields(
      {
        name: '📋 Before you begin',
        value: [
          '**Link Steam to Discord**',
          'Settings → Connections → Steam → sign in → enable **Display on profile**',
          '',
          '**Make your Steam profile public**',
          'Steam Community → Profile → Edit Profile → Privacy Settings',
          'Set **Game details** to **Public** and turn off private playtime',
          '',
          '**Finish the browser verification**',
          'Use the button below, complete the browser step, then return to this message.',
        ].join('\n'),
      },
      {
        name: 'Registration',
        value: [
          `Game: **${formatGameLabel(input.game)}**`,
          `Session expires: <t:${Math.floor(new Date(input.expiresAt).getTime() / 1000)}:R>`,
        ].join('\n'),
      },
      {
        name: 'Support',
        value: [
          '• **Epic Games copy of Civ VI?** Type `s! egs`',
          `• **Need help?** Ask <@&${config.discord.roles.moderator}> in <#${config.discord.channels.welcome}>`,
        ].join('\n'),
      },
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
    .setTitle('Registration complete')
    .setDescription('Your registration has been completed successfully and your CPL access has been updated.')
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
      {
        name: 'Next step',
        value: `You’re ready to use the normal CPL channels and commands for **${formatGameLabel(input.game)}**.`,
      },
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
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Manual registration complete')
    .setDescription('The registration was completed successfully and the member’s CPL access has been updated.')
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
    .setDescription('This registration session expired before it could finish. Run `/register register` to start again.');
}

export function buildRegistrationFailureEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration could not be completed')
    .setDescription(message);
}

export function buildDiscordLookupEmbed(account: DiscordLookupResponse): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Lookup by Discord ID')
    .setDescription(
      formatLookupSummary({
        label: 'Linked account records found',
        count: account.linked_accounts.length,
        multipleWarning: 'Multiple linked account records found for this Discord account.',
      }),
    )
    .addFields(...toDiscordLookupFields(account));
}

export function buildLinkedAccountLookupEmbed(account: LinkedAccountLookupResponse): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Lookup by linked account ID')
    .setDescription(
      formatLookupSummary({
        label: 'Discord accounts found',
        count: account.discord_accounts.length,
        multipleWarning: 'Multiple Discord accounts are tied to this linked account.',
      }),
    )
    .addFields(...toLinkedAccountLookupFields(account));
}
