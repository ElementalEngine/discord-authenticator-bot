import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { GAME_CHOICES } from '../../config/constants.js';
import type { SupportedGame } from '../../config/types.js';
import { buildManualRegistrationSuccessEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

const DISCORD_ID_RE = /^\d{17,20}$/;
const STEAM_ID_RE = /^\d{5,20}$/;

export function buildManualRegisterSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('manual-register')
    .setDescription('Create a registration manually for a Discord ID.')
    .addStringOption((option) => option.setName('discord-id').setDescription('Target Discord ID').setRequired(true))
    .addStringOption((option) =>
      option.setName('game').setDescription('Game to register').setRequired(true).addChoices(...GAME_CHOICES),
    )
    .addStringOption((option) => option.setName('steam-id').setDescription('Steam account ID').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Audit reason').setRequired(true));
}

export async function executeManualRegisterSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const discordId = interaction.options.getString('discord-id', true).trim();
  const game = interaction.options.getString('game', true) as SupportedGame;
  const steamId = interaction.options.getString('steam-id', true).trim();
  const reason = interaction.options.getString('reason', true).trim();

  if (!DISCORD_ID_RE.test(discordId)) {
    await interaction.reply({ content: 'Discord ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!STEAM_ID_RE.test(steamId)) {
    await interaction.reply({ content: 'Steam ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'Guild member cache is unavailable. Please try again.', flags: MessageFlags.Ephemeral });
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
      steamId,
      reason,
    });

    await interaction.editReply({
      embeds: [
        buildManualRegistrationSuccessEmbed({
          game: result.game,
          steamId: result.steam_id,
          steamName: result.steam_name ?? null,
          discordId: subject.id,
          discordUsername: subject.username,
          discordDisplayName: member.displayName,
          roleIntents: result.role_intents,
        }),
      ],
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
