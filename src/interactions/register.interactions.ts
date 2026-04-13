import { MessageFlags, type ButtonInteraction, type Client } from 'discord.js';
import { BUTTON_IDS } from '../config/constants.js';
import { RegisterService } from '../services/register.service.js';
import { RegistrationSessionWatchService } from '../services/registration-session-watch.service.js';
import {
  buildRegistrationFailureEmbed,
  buildRegistrationSuccessEmbed,
} from '../ui/embeds/register.js';
import { clearComponents } from '../ui/components/register.js';
import { safeEditReply } from '../utils/discord-safe.js';
import {
  authLogSeverity,
  shouldLogAuthIssue,
  shouldLogSystemError,
  stripLeadingStatusEmoji,
  toSystemErrorSummary,
  toUserErrorMessage,
} from '../utils/error-message.js';

function getSessionId(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) return null;
  const value = customId.slice(prefix.length).trim();
  return value || null;
}

export async function handleRegisterInteraction(
  interaction: ButtonInteraction,
  client: Client,
): Promise<boolean> {
  const services = new RegisterService(client);
  const watchService = new RegistrationSessionWatchService(services);

  const finishSessionId = getSessionId(interaction.customId, BUTTON_IDS.registrationFinishPrefix);
  if (finishSessionId) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'Guild member cache is unavailable. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    watchService.stop(finishSessionId);
    await interaction.deferUpdate();
    try {
      const result = await services.completeSelfServiceRegistration({
        sessionId: finishSessionId,
        actor: interaction.user,
        member: interaction.member,
      });
      await safeEditReply(interaction, {
        embeds: [
          buildRegistrationSuccessEmbed({
            game: result.game,
            steamId: result.steam_id,
            steamName: result.steam_name ?? null,
            discordId: interaction.user.id,
            discordUsername: interaction.user.username,
            discordDisplayName: interaction.member.displayName,
            roleIntents: result.role_intents,
          }),
        ],
        components: clearComponents(),
      });
    } catch (error) {
      const userMessage = toUserErrorMessage(error);
      await safeEditReply(interaction, {
        embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(userMessage))],
        components: clearComponents(),
      });
      if (shouldLogSystemError(error)) {
        await services.logs.logSystemError({
          title: 'Registration completion failed',
          actorId: interaction.user.id,
          subjectId: interaction.user.id,
          error,
          context: { session_id: finishSessionId },
        });
      } else if (shouldLogAuthIssue(error)) {
        await services.logs.logAuthIssue({
          title: 'Registration completion blocked',
          actorId: interaction.user.id,
          subjectId: interaction.user.id,
          message: stripLeadingStatusEmoji(userMessage),
          severity: authLogSeverity(error),
          technicalDetails: toSystemErrorSummary(error),
          context: { session_id: finishSessionId },
        });
      }
    }
    return true;
  }

  const cancelSessionId = getSessionId(interaction.customId, BUTTON_IDS.registrationCancelPrefix);
  if (cancelSessionId) {
    watchService.stop(cancelSessionId);
    await interaction.update({
      content: 'Registration flow cancelled. Run `/register register` to start again.',
      embeds: [],
      components: clearComponents(),
    });
    return true;
  }

  return false;
}
