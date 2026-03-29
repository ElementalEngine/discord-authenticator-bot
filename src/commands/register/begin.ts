import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { GAME_CHOICES } from '../../config/constants.js';
import type { SupportedGame } from '../../config/types.js';
import { buildRegistrationStartEmbed } from '../../ui/embeds/register.js';
import { buildRegistrationButtons } from '../../ui/components/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';
import { config } from '../../config/index.js';
import { startRegistrationSessionWatch } from '../../services/registration-session-watch.service.js';

export function buildBeginSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('register')
    .setDescription('Start Discord + Steam registration.')
    .addStringOption((option) =>
      option
        .setName('game')
        .setDescription('Which game you want to register for.')
        .setRequired(true)
        .addChoices(...GAME_CHOICES),
    );
}

export async function executeBeginSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const game = interaction.options.getString('game', true) as SupportedGame;

  if (interaction.channelId !== config.discord.channels.welcome) {
    await interaction.reply({
      content: `Use this command in <#${config.discord.channels.welcome}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Guild member cache is unavailable. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.member.roles.cache.has(config.discord.roles.nonVerified)) {
    await interaction.reply({
      content: 'Only users with the non-verified role can start registration.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const session = await services.createRegistrationSession(interaction.user.id, game);
    await interaction.editReply({
      embeds: [buildRegistrationStartEmbed({ game, expiresAt: session.expires_at })],
      components: [buildRegistrationButtons({ authorizeUrl: session.authorize_url, sessionId: session.session_id })],
    });
    startRegistrationSessionWatch({
      sessionId: session.session_id,
      expiresAt: session.expires_at,
      interaction,
      member: interaction.member,
      services,
    });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Registration start failed',
      actorId: interaction.user.id,
      error,
    });
  }
}
