import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_NAMES, GAME_CHOICES, MANUAL_REGISTER_PLATFORM_CHOICES } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { ensureCommandAccess } from '../../utils/ensure-command-access.js';
import { isSupportedGame, isManualRegistrationChoice } from '../../utils/option-guards.js';
import { buildManualRegistrationSuccessEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import { logAuthCommandFailure } from '../../utils/auth-command-failure.js';
import { registerService as services } from '../../services/register.instance.js';
import { SNOWFLAKE_RE } from '../../utils/patterns.js';


export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.manualRegister)
  .setDescription('Staff: manually register a Discord user for a game.')
  .addStringOption((option) =>
    option.setName('game').setDescription('Game to register').setRequired(true).addChoices(...GAME_CHOICES),
  )
  .addStringOption((option) =>
    option.setName('discord-id').setDescription('Target Discord ID').setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('platform')
      .setDescription('Linked platform for this manual registration')
      .setRequired(true)
      .addChoices(...MANUAL_REGISTER_PLATFORM_CHOICES),
  )
  .addStringOption((option) =>
    option.setName('platform-account-id').setDescription('Platform account ID').setRequired(true),
  )
  .addStringOption((option) =>
    option.setName('discord-display-name').setDescription('Discord display name (optional)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('discord-account-name').setDescription('Discord account/username (optional)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('platform-account-name').setDescription('Platform account name (optional)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('reason').setDescription('Audit reason (optional)').setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const allowed = await ensureCommandAccess(interaction, {
    allowedChannelIds: [config.discord.channels.botCommands],
    requiredRoleIds: [config.discord.roles.moderator],
    allowDeveloperOverride: true,
  });
  if (!allowed) return;

  const game = interaction.options.getString('game', true);
  const discordId = interaction.options.getString('discord-id', true).trim();
  const platform = interaction.options.getString('platform', true);
  const accountId = interaction.options.getString('platform-account-id', true).trim();
  const displayName = interaction.options.getString('discord-display-name', false)?.trim() || undefined;
  const username = interaction.options.getString('discord-account-name', false)?.trim() || undefined;
  const accountName = interaction.options.getString('platform-account-name', false)?.trim() || undefined;
  const reason = interaction.options.getString('reason', false)?.trim() || undefined;

  if (!isSupportedGame(game)) {
    await interaction.reply({
      content: 'Unknown game option. Please re-run the command and pick one of the provided choices.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!isManualRegistrationChoice(platform)) {
    await interaction.reply({
      content: 'Unknown platform option. Please re-run the command and pick one of the provided choices.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!SNOWFLAKE_RE.test(discordId)) {
    await interaction.reply({ content: 'Discord ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!accountId) {
    await interaction.reply({ content: 'Platform account ID must not be blank.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer early, before the guild member fetch and the backend call (goal #1).
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.inCachedGuild()) {
    await interaction.editReply({ content: 'Guild member cache is unavailable. Please try again.' });
    return;
  }

  const member = await interaction.guild.members.fetch(discordId).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: 'Could not fetch that member from the guild.' });
    return;
  }

  try {
    const result = await services.manualRegister({
      actor: interaction.user,
      subject: member.user,
      member,
      game,
      platform,
      accountId,
      accountName,
      discordUsername: username,
      discordDisplayName: displayName,
      reason,
    });

    await interaction.editReply({
      embeds: [
        buildManualRegistrationSuccessEmbed({
          game: result.game,
          platform: result.linked_platform ?? 'steam',
          accountId: result.linked_account_id ?? accountId,
          accountName: result.linked_account_name ?? accountName ?? null,
          discordId: member.id,
          discordUsername: username ?? member.user.username,
          discordDisplayName: displayName ?? member.displayName,
          roleIntents: result.role_intents,
          registrationMethod: result.registration_method,
        }),
      ],
    });
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await interaction.editReply({ content: userMessage });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Manual registration failed',
      actorId: interaction.user.id,
      subjectId: discordId,
      error,
      userMessage,
      context: {
        game,
        platform,
        platform_account_id: accountId,
        platform_account_name: accountName ?? 'not_provided',
        reason: reason ?? 'not_provided',
      },
    });
  }
}
