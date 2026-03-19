import type { ButtonInteraction, Client } from 'discord.js';
import { BUTTON_IDS } from '../config/constants.js';
import { RegisterService } from '../services/register.service.js';
import { buildRegistrationSuccessEmbed } from '../ui/embeds/register.js';
import { clearComponents } from '../ui/components/register.js';
import { safeEditReply } from '../utils/discord-safe.js';
import { toUserErrorMessage } from '../utils/error-message.js';

function getSessionId(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) return null;
  const value = customId.slice(prefix.length).trim();
  return value || null;
}

export async function handleRegisterInteraction(
  interaction: ButtonInteraction,
  client: Client,
): Promise<boolean> {
  const finishSessionId = getSessionId(interaction.customId, BUTTON_IDS.registrationFinishPrefix);
  if (finishSessionId) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: 'Guild member cache is unavailable. Please try again.', ephemeral: true });
      return true;
    }

    await interaction.deferUpdate();
    const services = new RegisterService(client);
    try {
      const result = await services.completeRegistration({
        interaction,
        sessionId: finishSessionId,
        member: interaction.member,
      });
      await safeEditReply(interaction, {
        embeds: [buildRegistrationSuccessEmbed({ game: result.game, steamId: result.steam_id, roleIntents: result.role_intents })],
        components: clearComponents(),
      });
    } catch (error) {
      await safeEditReply(interaction, { content: toUserErrorMessage(error), components: clearComponents() });
      await services.logs.logSystemError({
        title: 'Registration completion failed',
        actorId: interaction.user.id,
        subjectId: interaction.user.id,
        error,
      });
    }
    return true;
  }

  const cancelSessionId = getSessionId(interaction.customId, BUTTON_IDS.registrationCancelPrefix);
  if (cancelSessionId) {
    await interaction.update({ content: 'Registration flow cancelled. Run `/register register` to start again.', embeds: [], components: clearComponents() });
    return true;
  }

  return false;
}
