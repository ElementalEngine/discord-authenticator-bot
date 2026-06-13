import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { RegisterService } from '../../services/register.service.js';
import { ensureRegistrationGate, startSteamRegistration } from './steam-flow.js';

export function buildCiv6Subcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('civ6')
    .setDescription('Register for Civilization VI with Steam.');
}

export async function executeCiv6Subcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const member = await ensureRegistrationGate(interaction);
  if (!member) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await startSteamRegistration({ interaction, user: interaction.user, member, game: 'civ6', services });
}
