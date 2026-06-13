import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from 'discord.js';
import type { SupportedGame } from '../../config/types.js';
import { config } from '../../config/index.js';
import { buildRegistrationStartEmbed } from '../../ui/embeds/register.js';
import { buildRegistrationButtons, clearComponents } from '../../ui/components/register.js';
import { safeEditReply } from '../../utils/discord-safe.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import { logAuthCommandFailure } from '../../utils/auth-command-failure.js';
import type { RegisterService } from '../../services/register.service.js';
import { RegistrationSessionWatchService } from '../../services/registration-session-watch.service.js';

export async function ensureRegistrationGate(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
  if (interaction.channelId !== config.discord.channels.welcome) {
    await interaction.reply({
      content: `Use this command in <#${config.discord.channels.welcome}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Guild member cache is unavailable. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (!interaction.member.roles.cache.has(config.discord.roles.nonVerified)) {
    await interaction.reply({
      content: 'Only users with the non-verified role can start registration.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return interaction.member;
}

export async function startSteamRegistration(input: {
  interaction: ChatInputCommandInteraction | ButtonInteraction;
  user: User;
  member: GuildMember;
  game: SupportedGame;
  services: RegisterService;
}): Promise<void> {
  const { interaction, user, member, game, services } = input;
  try {
    const session = await services.createRegistrationSession(user.id, game);
    await safeEditReply(interaction, {
      embeds: [buildRegistrationStartEmbed({ game, expiresAt: session.expires_at })],
      components: [buildRegistrationButtons({ authorizeUrl: session.authorize_url, sessionId: session.session_id })],
    });

    new RegistrationSessionWatchService(services).start({
      interaction,
      sessionId: session.session_id,
      user,
      member,
      game,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await safeEditReply(interaction, { content: userMessage, embeds: [], components: clearComponents() });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Registration start failed',
      actorId: user.id,
      subjectId: user.id,
      error,
      userMessage,
      context: { game },
    });
  }
}
