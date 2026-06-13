import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildCiv7MethodSelectEmbed } from '../../ui/embeds/register.js';
import { buildCiv7MethodButtons } from '../../ui/components/register.js';
import { ensureRegistrationGate } from './steam-flow.js';

export function buildCiv7Subcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('civ7')
    .setDescription('Register for Civilization VII (Steam API or manual 2K).');
}

export async function executeCiv7Subcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = await ensureRegistrationGate(interaction);
  if (!member) return;

  await interaction.reply({
    embeds: [buildCiv7MethodSelectEmbed()],
    components: [buildCiv7MethodButtons()],
    flags: MessageFlags.Ephemeral,
  });
}
