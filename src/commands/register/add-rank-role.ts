import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { GAME_CHOICES } from '../../config/constants.js';
import type { SupportedGame } from '../../config/types.js';
import { buildRankRoleSuccessEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';
import { config } from '../../config/index.js';

export function buildAddRankRoleSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('add-rank-role')
    .setDescription('Add an additional ranked role after registration.')
    .addStringOption((option) =>
      option
        .setName('game')
        .setDescription('Which game role to add.')
        .setRequired(true)
        .addChoices(...GAME_CHOICES),
    );
}

export async function executeAddRankRoleSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const game = interaction.options.getString('game', true) as SupportedGame;
  const allowedChannels = [config.discord.channels.civ6Commands, config.discord.channels.civ7Commands];
  if (!allowedChannels.includes(interaction.channelId)) {
    await interaction.reply({
      content: `Use this command in <#${config.discord.channels.civ6Commands}> or <#${config.discord.channels.civ7Commands}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'Guild member cache is unavailable. Please try again.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await services.addRankRole({
      user: interaction.user,
      game,
      member: interaction.member,
    });

    await interaction.editReply({
      embeds: [buildRankRoleSuccessEmbed({ game: result.game, roleIntents: result.role_intents })],
    });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Add rank role failed',
      actorId: interaction.user.id,
      subjectId: interaction.user.id,
      error,
    });
  }
}
