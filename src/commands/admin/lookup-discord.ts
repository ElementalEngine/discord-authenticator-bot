import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLookupDiscordEmbed } from '../../ui/embeds/register.js';
import { shouldLogSystemError, toUserErrorMessage } from '../../utils/error-message.js';
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
    await interaction.editReply({ content: toUserErrorMessage(error) });
    if (shouldLogSystemError(error)) {
      await services.logs.logSystemError({
        title: 'Lookup by Discord ID failed',
        actorId: interaction.user.id,
        error,
        context: { discord_id: discordId },
      });
    }
  }
}
