import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { GAME_CHOICES, REGISTRATION_PLATFORM_CHOICES } from '../../config/constants.js';
import type { SupportedGame } from '../../config/types.js';
import { buildManualRegistrationSuccessEmbed } from '../../ui/embeds/register.js';
import type { RegistrationPlatform } from '../../api/types.js';
import { shouldLogSystemError, toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

const DISCORD_ID_RE = /^\d{17,20}$/;
const STEAM_ID_RE = /^\d{5,20}$/;

export function buildManualRegisterSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('manual-register')
    .setDescription('Create a manual registration for a Discord ID.')
    .addStringOption((option) => option.setName('discord-id').setDescription('Target Discord ID').setRequired(true))
    .addStringOption((option) => option.setName('discord-username').setDescription('Discord username').setRequired(true))
    .addStringOption((option) =>
      option.setName('game').setDescription('Game to register').setRequired(true).addChoices(...GAME_CHOICES),
    )
    .addStringOption((option) =>
      option
        .setName('platform')
        .setDescription('Linked platform for this manual registration')
        .setRequired(true)
        .addChoices(...REGISTRATION_PLATFORM_CHOICES),
    )
    .addStringOption((option) =>
      option.setName('platform-account-id').setDescription('Platform account ID').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('platform-account-name').setDescription('Platform account name').setRequired(true),
    )
    .addStringOption((option) => option.setName('reason').setDescription('Audit reason').setRequired(false));
}

export async function executeManualRegisterSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const discordId = interaction.options.getString('discord-id', true).trim();
  const discordUsername = interaction.options.getString('discord-username', true).trim();
  const game = interaction.options.getString('game', true) as SupportedGame;
  const platform = interaction.options.getString('platform', true) as RegistrationPlatform;
  const platformAccountId = interaction.options.getString('platform-account-id', true).trim();
  const platformAccountName = interaction.options.getString('platform-account-name', true).trim();
  const reason = interaction.options.getString('reason', false)?.trim() || undefined;

  if (!DISCORD_ID_RE.test(discordId)) {
    await interaction.reply({ content: 'Discord ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!discordUsername) {
    await interaction.reply({ content: 'Discord username must not be blank.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!platformAccountName) {
    await interaction.reply({ content: 'Platform account name must not be blank.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (platform === 'steam' && !STEAM_ID_RE.test(platformAccountId)) {
    await interaction.reply({ content: 'Steam account ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Guild member cache is unavailable. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subject = await interaction.client.users.fetch(discordId).catch(() => null);
  if (!subject) {
    await interaction.reply({ content: 'Could not fetch a Discord user for that ID.', flags: MessageFlags.Ephemeral });
    return;
  }

  const member = await interaction.guild.members.fetch(discordId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'Could not fetch that member from the guild.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await services.manualRegister({
      actor: interaction.user,
      subject,
      member,
      game,
      platform,
      accountId: platformAccountId,
      accountName: platformAccountName,
      discordUsername,
      reason,
    });

    await interaction.editReply({
      embeds: [
        buildManualRegistrationSuccessEmbed({
          game: result.game,
          platform: result.linked_platform ?? platform,
          accountId: result.linked_account_id ?? platformAccountId,
          accountName: result.linked_account_name ?? platformAccountName,
          discordId: subject.id,
          discordUsername,
          discordDisplayName: member.displayName,
          roleIntents: result.role_intents,
        }),
      ],
    });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    if (shouldLogSystemError(error)) {
      await services.logs.logSystemError({
        title: 'Manual registration failed',
        actorId: interaction.user.id,
        subjectId: subject.id,
        error,
        context: {
          game,
          platform,
          platform_account_id: platformAccountId,
        },
      });
    }
  }
}