import {
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { BUTTON_IDS, MODAL_FIELD_IDS, MODAL_IDS } from '../config/constants.js';
import {
  registerService,
  registrationWatchService,
} from '../services/register.instance.js';
import {
  buildRegistrationFailureEmbed,
  buildRegistrationSuccessEmbed,
  buildSelfServiceSuccessEmbed,
} from '../ui/embeds/register.js';
import {
  buildSelfServiceManualModal,
  clearComponents,
} from '../ui/components/register.js';
import { startSteamRegistration } from '../commands/register/steam-flow.js';
import { safeEditReply } from '../utils/discord-safe.js';
import { stripLeadingStatusEmoji, toUserErrorMessage } from '../utils/error-message.js';
import { logAuthCommandFailure } from '../utils/auth-command-failure.js';

function getSessionId(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) return null;
  const value = customId.slice(prefix.length).trim();
  return value || null;
}

export async function handleRegisterInteraction(interaction: ButtonInteraction): Promise<boolean> {
  const services = registerService;
  const watchService = registrationWatchService;

  // Civ 7 method selection — Steam API Auth.
  if (interaction.customId === BUTTON_IDS.civ7MethodSteam) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'Guild member cache is unavailable. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    await interaction.deferUpdate();
    await startSteamRegistration({
      interaction,
      user: interaction.user,
      member: interaction.member,
      game: 'civ7',
      services,
    });
    return true;
  }

  // Civ 7 method selection — Manual Register (2K) opens a modal.
  if (interaction.customId === BUTTON_IDS.civ7MethodManual) {
    await interaction.showModal(buildSelfServiceManualModal());
    return true;
  }

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
      await logAuthCommandFailure({
        logs: services.logs,
        title: 'Registration completion failed',
        actorId: interaction.user.id,
        subjectId: interaction.user.id,
        error,
        userMessage,
        context: { session_id: finishSessionId },
      });
    }
    return true;
  }

  const cancelSessionId = getSessionId(interaction.customId, BUTTON_IDS.registrationCancelPrefix);
  if (cancelSessionId) {
    watchService.stop(cancelSessionId);
    await interaction.update({
      content: 'Registration flow cancelled. Run `/register civ6` or `/register civ7` to start again.',
      embeds: [],
      components: clearComponents(),
    });
    return true;
  }

  if (interaction.customId.startsWith('auth:')) {
    await interaction.reply({
      content: 'This registration action is no longer available. Please start again with `/register civ6` or `/register civ7`.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

export async function handleRegisterModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (interaction.customId !== MODAL_IDS.civ7SelfServiceManual) return false;

  const services = registerService;

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Guild member cache is unavailable. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const accountId = interaction.fields.getTextInputValue(MODAL_FIELD_IDS.twoKAccountId).trim();
  const accountName = interaction.fields.getTextInputValue(MODAL_FIELD_IDS.twoKAccountName).trim() || undefined;

  if (!accountId) {
    await interaction.reply({ content: '2K account ID must not be blank.', flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await services.selfServiceRegister({
      actor: interaction.user,
      member: interaction.member,
      game: 'civ7',
      accountId,
      accountName,
    });
    await interaction.editReply({
      embeds: [
        buildSelfServiceSuccessEmbed({
          game: result.game,
          platform: result.linked_platform ?? '2k',
          accountId: result.linked_account_id ?? accountId,
          accountName: result.linked_account_name ?? accountName ?? null,
          discordId: interaction.user.id,
          discordUsername: interaction.user.username,
          discordDisplayName: interaction.member.displayName,
          roleIntents: result.role_intents,
          registrationMethod: result.registration_method ?? 'self_service_2k',
        }),
      ],
    });
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await interaction.editReply({
      embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(userMessage))],
    });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Civ 7 2K self-service registration failed',
      actorId: interaction.user.id,
      subjectId: interaction.user.id,
      error,
      userMessage,
      context: { game: 'civ7', platform: '2k', platform_account_id: accountId },
    });
  }
  return true;
}