import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLookupEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

const DISCORD_ID_RE = /^\d{17,20}$/;

export function buildLookupDiscordSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('lookup-discord')
    .setDescription('Look up an account by Discord ID.')
    .addUserOption((option) => option.setName('user').setDescription('Target Discord user').setRequired(false))
    .addStringOption((option) => option.setName('discord-id').setDescription('Raw Discord ID').setRequired(false));
}

export async function executeLookupDiscordSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const user = interaction.options.getUser('user', false);
  const rawId = interaction.options.getString('discord-id', false)?.trim();
  const discordId = user?.id ?? rawId;

  if (!discordId || !DISCORD_ID_RE.test(discordId)) {
    await interaction.reply({ content: 'Provide a valid Discord user or Discord ID.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const account = await services.lookupByDiscordId(discordId);
    await interaction.editReply({ embeds: [buildLookupEmbed({ title: 'Account lookup by Discord ID', account })] });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Lookup by Discord ID failed',
      actorId: interaction.user.id,
      error,
    });
  }
}
