import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_NAMES, REGISTER_SUBCOMMANDS } from '../../config/constants.js';
import { buildBeginSubcommand, executeBeginSubcommand } from './begin.js';
import { buildAddRankRoleSubcommand, executeAddRankRoleSubcommand } from './add-rank-role.js';
import { RegisterService } from '../../services/register.service.js';
import client from '../../client.js';

const services = new RegisterService(client);

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.register)
  .setDescription('Registration and ranked-role commands.')
  .addSubcommand(buildBeginSubcommand)
  .addSubcommand(buildAddRankRoleSubcommand);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);
  switch (subcommand) {
    case REGISTER_SUBCOMMANDS.register:
      await executeBeginSubcommand(interaction, services);
      return;
    case REGISTER_SUBCOMMANDS.addRankRole:
      await executeAddRankRoleSubcommand(interaction, services);
      return;
    default:
      await interaction.reply({ content: 'Unsupported subcommand.', ephemeral: true });
  }
}
