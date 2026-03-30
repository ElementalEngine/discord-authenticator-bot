import { EmbedBuilder } from 'discord.js';
import type { AccountLookupResponse, RoleIntent } from '../../api/types.js';
import { config } from '../../config/index.js';
import type { SupportedGame } from '../../config/types.js';
import {
  formatAppliedRoleUpdates,
  formatDiscordAccount,
  formatGameLabel,
  formatSteamAccount,
} from '../formatters/registration-display.js';

export function buildRegistrationStartEmbed(input: {
  game: SupportedGame;
  expiresAt: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Welcome to CivPlayers Leagues')
    .setDescription(
      'Read the server rules and Discord\'s **Terms of Service**, **Community Guidelines**, and **Partner Code of Conduct** before you continue.\n\n' +
        'Use **Start Discord verification** below to begin Discord + Steam verification.\n' +
        'This message updates automatically when the checks finish. You do **not** need a finish button.',
    )
    .addFields(
      {
        name: '✅ Before you begin',
        value:
          '**1. Link Steam to Discord**\n' +
          'Settings → Connections → Steam → sign in → enable **Display on profile**\n\n' +
          '**2. Make your Steam profile public**\n' +
          'Steam Community → Profile → Edit Profile → Privacy Settings\n' +
          'Set **Game details** to **Public** and turn off private playtime\n\n' +
          '**3. Finish the browser verification**\n' +
          'Use the button below, complete the browser step, then return to this message.',
      },
      {
        name: 'Registration',
        value:
          `Game: **${formatGameLabel(input.game)}**\n` +
          `Session expires: <t:${Math.floor(new Date(input.expiresAt).getTime() / 1000)}:R>`,
      },
      {
        name: 'Need help?',
        value:
          '• **Epic Games copy of Civ VI?** Type `s! egs`\n' +
          `• **Need help?** Ask <@&${config.discord.roles.moderator}> in <#${config.discord.channels.welcome}>`,
      },
    );
}

export function buildRegistrationSuccessEmbed(input: {
  game: SupportedGame;
  discordId: string;
  discordDisplayName?: string | null;
  discordUsername?: string | null;
  steamId: string;
  steamName?: string | null;
  roleIntents: readonly RoleIntent[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration complete')
    .setDescription('Your Discord and Steam accounts were verified successfully, and your CPL access has been updated.')
    .addFields(
      {
        name: 'Discord account',
        value: formatDiscordAccount({
          discordId: input.discordId,
          displayName: input.discordDisplayName,
          username: input.discordUsername,
        }),
      },
      {
        name: 'Steam account',
        value: formatSteamAccount({ steamId: input.steamId, steamName: input.steamName }),
      },
      { name: 'Game', value: formatGameLabel(input.game), inline: true },
      { name: 'Discord role updates', value: formatAppliedRoleUpdates(input.roleIntents) },
      {
        name: 'Next step',
        value: `You're ready to use the normal CPL channels and commands for **${formatGameLabel(input.game)}**.`,
      },
    );
}

export function buildRegistrationExpiredEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration expired')
    .setDescription('This registration session expired. Run `/register register` to start again with a fresh link.');
}

export function buildRegistrationCompletedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration already completed')
    .setDescription('This registration session has already been completed. You can continue in the normal CPL channels for your game.');
}

export function buildRegistrationFailureEmbed(input: {
  message: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration could not be completed')
    .setDescription(input.message);
}

export function buildLookupEmbed(input: { title: string; account: AccountLookupResponse }): EmbedBuilder {
  const registrations = Object.entries(input.account.registrations ?? {}).map(([game, value]) => {
    if (!value) return null;
    return `${formatGameLabel(game as SupportedGame)}: ${value.status} (${value.method})`;
  }).filter((value): value is string => Boolean(value));

  return new EmbedBuilder()
    .setTitle(input.title)
    .addFields(
      { name: 'Discord ID', value: `\`${input.account.discord_id}\`` },
      { name: 'Steam ID', value: input.account.steam_id ? `\`${input.account.steam_id}\`` : 'Not linked' },
      { name: 'Username snapshot', value: input.account.username_snapshot ?? 'Unknown', inline: true },
      { name: 'Display snapshot', value: input.account.display_name_snapshot ?? 'Unknown', inline: true },
      { name: 'Registrations', value: registrations.join('\n') || 'None' },
    );
}
