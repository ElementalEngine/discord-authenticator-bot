import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_NAMES, REGISTER_SUBCOMMANDS } from '../../config/constants.js';
import { buildCiv6Subcommand, executeCiv6Subcommand } from './civ6.js';
import { buildCiv7Subcommand, executeCiv7Subcommand } from './civ7.js';
import { buildAddRankRoleSubcommand, executeAddRankRoleSubcommand } from './add-rank-role.js';
import { RegisterService } from '../../services/register.service.js';
import client from '../../client.js';

const services = new RegisterService(client);

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.register)
  .setDescription('Registration and ranked-role commands.')
  .addSubcommand(buildCiv6Subcommand)
  .addSubcommand(buildCiv7Subcommand)
  .addSubcommand(buildAddRankRoleSubcommand);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);
  switch (subcommand) {
    case REGISTER_SUBCOMMANDS.civ6:
      await executeCiv6Subcommand(interaction, services);
      return;
    case REGISTER_SUBCOMMANDS.civ7:
      await executeCiv7Subcommand(interaction);
      return;
    case REGISTER_SUBCOMMANDS.addRankRole:
      await executeAddRankRoleSubcommand(interaction, services);
      return;
    default:
      await interaction.reply({ content: 'Unsupported subcommand.', flags: MessageFlags.Ephemeral });
  }
}
