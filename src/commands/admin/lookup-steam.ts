import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLookupEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

const STEAM_ID_RE = /^\d{5,20}$/;

export function buildLookupSteamSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('lookup-steam')
    .setDescription('Look up an account by Steam ID.')
    .addStringOption((option) => option.setName('steam-id').setDescription('Steam ID').setRequired(true));
}

export async function executeLookupSteamSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const steamId = interaction.options.getString('steam-id', true).trim();
  if (!STEAM_ID_RE.test(steamId)) {
    await interaction.reply({ content: 'Steam ID must be numeric.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const account = await services.lookupBySteamId(steamId);
    await interaction.editReply({ embeds: [buildLookupEmbed({ title: 'Account lookup by Steam ID', account })] });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Lookup by Steam ID failed',
      actorId: interaction.user.id,
      error,
    });
  }
}
