import { EmbedBuilder } from 'discord.js';
import type { AccountLookupResponse } from '../../api/types.js';
import type { SupportedGame } from '../../config/types.js';

export function buildRegistrationStartEmbed(input: {
  game: SupportedGame;
  expiresAt: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Complete registration')
    .setDescription('Authorize your Discord account, then return here and press **Finish registration**.')
    .addFields(
      { name: 'Game', value: input.game.toUpperCase(), inline: true },
      { name: 'Expires', value: `<t:${Math.floor(new Date(input.expiresAt).getTime() / 1000)}:R>`, inline: true },
    );
}

export function buildRegistrationSuccessEmbed(input: {
  game: SupportedGame;
  steamId: string;
  roleIntents: readonly string[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Registration complete')
    .setDescription('Your account has been verified and your Discord roles were updated.')
    .addFields(
      { name: 'Game', value: input.game.toUpperCase(), inline: true },
      { name: 'Steam ID', value: `\`${input.steamId}\``, inline: true },
      { name: 'Applied intents', value: input.roleIntents.map((value) => `• ${value}`).join('\n') || 'None' },
    );
}

export function buildLookupEmbed(input: { title: string; account: AccountLookupResponse }): EmbedBuilder {
  const registrations = Object.entries(input.account.registrations ?? {}).map(([game, value]) => {
    if (!value) return null;
    return `${game.toUpperCase()}: ${value.status} (${value.method})`;
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
