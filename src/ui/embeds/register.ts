import { EmbedBuilder } from 'discord.js';
import type { AccountLookupResponse, RoleIntent } from '../../api/types.js';
import type { SupportedGame } from '../../config/types.js';
import { formatAppliedRoleUpdates, formatGameLabel, formatSteamAccount } from '../../utils/registration-display.js';

export function buildRegistrationStartEmbed(input: {
  game: SupportedGame;
  expiresAt: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Welcome to CivPlayers Leagues')
    .setDescription(
      `Before continuing, please read **#rules** and Discord's **Terms of Service**, **Community Guidelines**, and **Partner Code of Conduct**.\n\nClick **Authorize** below to start Discord + Steam verification. This message updates automatically when the checks finish.`,
    )
    .addFields(
      {
        name: 'Before you register',
        value:
          '**1. Link Steam to Discord**\n' +
          'Settings → Connections → Steam → sign in → enable **Display on profile**\n\n' +
          '**2. Make your Steam profile public**\n' +
          'Steam Community → Profile → Edit Profile → Privacy Settings\n' +
          'Set **Game details** to **Public** and turn off private playtime\n\n' +
          '**3. Stay on this message**\n' +
          'Use the **Authorize** button below, complete the browser step, then return here. No extra finish button is needed.',
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
          '• Epic Games copy of Civ VI: type `s! egs`\n' +
          '• Mac users may need a virtual machine\n' +
          '• Ping **@CPL Staff** in **#commands-unverified**\n' +
          '• Subscribe to the mods used in most CPL Civ VI games',
      },
    );
}

export function buildRegistrationSuccessEmbed(input: {
  game: SupportedGame;
  steamId: string;
  steamName?: string | null;
  roleIntents: readonly RoleIntent[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration complete')
    .setDescription('Your account has been verified and your Discord access has been updated successfully.')
    .addFields(
      { name: 'Game', value: formatGameLabel(input.game), inline: true },
      { name: 'Steam account', value: formatSteamAccount({ steamId: input.steamId, steamName: input.steamName }), inline: true },
      { name: 'Discord updates', value: formatAppliedRoleUpdates(input.roleIntents) },
      { name: 'Next step', value: 'You can now continue in the normal CPL channels for your game.' },
    );
}

export function buildRegistrationExpiredEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration expired')
    .setDescription('This registration session expired. Run `/register register` to start again with a fresh link.');
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
