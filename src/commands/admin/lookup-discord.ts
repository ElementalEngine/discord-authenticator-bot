import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLookupDiscordEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import { logAuthCommandFailure } from '../../utils/auth-command-failure.js';
import type { RegisterService } from '../../services/register.service.js';

const DISCORD_ID_RE = /^\d{17,20}$/;

export function buildLookupDiscordSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('lookup-discord')
    .setDescription('Look up an account by Discord ID.')
    .addStringOption((option) => option.setName('discord-id').setDescription('Discord ID').setRequired(true));
}

export async function executeLookupDiscordSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const discordId = interaction.options.getString('discord-id', true).trim();

  if (!DISCORD_ID_RE.test(discordId)) {
    await interaction.reply({ content: 'Discord ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const account = await services.lookupByDiscordId(discordId);
    await interaction.editReply({ embeds: [buildLookupDiscordEmbed(account)] });
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await interaction.editReply({ content: userMessage });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Lookup by Discord ID failed',
      actorId: interaction.user.id,
      error,
      userMessage,
      context: { discord_id: discordId },
    });
  }
}
