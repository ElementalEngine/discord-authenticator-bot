import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { GAME_CHOICES } from '../../config/constants.js';
import type { SupportedGame } from '../../config/types.js';
import { buildRegistrationSuccessEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

const STEAM_ID_RE = /^\d{5,20}$/;

export function buildManualRegisterSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('manual-register')
    .setDescription('Create a registration manually for a user.')
    .addUserOption((option) => option.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((option) =>
      option.setName('game').setDescription('Game to register').setRequired(true).addChoices(...GAME_CHOICES),
    )
    .addStringOption((option) => option.setName('steam-id').setDescription('Steam account id').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Audit reason').setRequired(true));
}

export async function executeManualRegisterSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const subject = interaction.options.getUser('user', true);
  const game = interaction.options.getString('game', true) as SupportedGame;
  const steamId = interaction.options.getString('steam-id', true).trim();
  const reason = interaction.options.getString('reason', true).trim();

  if (!STEAM_ID_RE.test(steamId)) {
    await interaction.reply({ content: 'Steam ID must be numeric.', ephemeral: true });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'Guild member cache is unavailable. Please try again.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(subject.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'Could not fetch the target member from the guild.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await services.manualRegister({
      actor: interaction.user,
      subject,
      member,
      game,
      steamId,
      reason,
    });

    await interaction.editReply({
      embeds: [buildRegistrationSuccessEmbed({ game: result.game, steamId: result.steam_id, roleIntents: result.role_intents })],
    });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Manual registration failed',
      actorId: interaction.user.id,
      subjectId: subject.id,
      error,
    });
  }
}
