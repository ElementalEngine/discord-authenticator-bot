import { DiscordAPIError, InteractionContextType, RESTJSONErrorCodes, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import { api } from '../api/client.js';
import type { ManualPlatform } from '../api/types.js';
import { failed, settle, written } from '../flows/outcome.js';
import { refuse } from '../ui/failure.js';
import * as panels from '../ui/panels.js';
import { defer, show } from '../ui/reply.js';
import { SNOWFLAKE } from '../config/index.js';
import { GAME_CHOICES, gameOption, gate } from './gate.js';

const STEAM_ID = /^7656119\d{10}$/;
const PLATFORMS = [
  { name: 'Steam', value: 'steam' },
  { name: 'Steam Family Share', value: 'steam_family_share' },
  { name: '2K', value: '2k' },
] as const satisfies readonly { name: string; value: ManualPlatform }[];

export const data = new SlashCommandBuilder()
  .setName('manual-register')
  .setDescription('Staff: register a player by hand.')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) => option.setName('game').setDescription('The game').setRequired(true).addChoices(...GAME_CHOICES))
  .addStringOption((option) => option.setName('discord-id').setDescription("The player's Discord id").setRequired(true).setMaxLength(20))
  .addStringOption((option) => option.setName('platform').setDescription('Where they play').setRequired(true).addChoices(...PLATFORMS))
  .addStringOption((option) => option.setName('platform-account-id').setDescription('Their Steam or 2K account id').setRequired(true).setMaxLength(128))
  .addStringOption((option) => option.setName('platform-account-name').setDescription('Their Steam or 2K name').setMaxLength(128))
  .addStringOption((option) => option.setName('reason').setDescription('Why, for the log').setMaxLength(500));

const platformOption = (value: string): ManualPlatform =>
  PLATFORMS.find((platform) => platform.value === value)?.value ?? refuse('Pick a platform from the list.');

export async function run(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  gate(interaction, 'manual-register');
  const game = gameOption(interaction);
  const discordId = interaction.options.getString('discord-id', true).trim();
  const platform = platformOption(interaction.options.getString('platform', true));
  const accountId = interaction.options.getString('platform-account-id', true).trim();
  const accountName = interaction.options.getString('platform-account-name')?.trim() || null;
  const reason = interaction.options.getString('reason')?.trim() || null;
  if (!SNOWFLAKE.test(discordId)) refuse('A Discord id is 17 to 20 digits.');
  if (!accountId) refuse('Enter the account id.');
  if (platform !== '2k' && !STEAM_ID.test(accountId)) refuse('A Steam id is 17 digits starting 7656119.');

  await defer(interaction);
  try {
    // Fetched fresh: the bot has no member events, so its cache can be stale.
    const member = await interaction.guild.members.fetch({ user: discordId, force: true }).catch((error: unknown) => {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember) return refuse('That player is not in this server.');
      throw error;
    });
    const write = api.registerManually(interaction.user.id, {
      subject_discord_id: discordId,
      game,
      platform,
      platform_account_id: accountId,
      platform_account_name: accountName,
      discord_username: member.user.username,
      discord_display_name: member.displayName,
      reason,
    });
    const registration = await written(interaction.guild, discordId, 'register a player by hand', write, false);
    const sync = await settle(interaction.guild, member, registration, 'staff', { id: interaction.user.id, reason });
    await show(interaction, panels.registeredBy(registration, sync));
  } catch (error) {
    await show(interaction, await failed(interaction.guild, discordId, error, 'register a player by hand'));
  }
}
