import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { ensureCommandAccess } from '../../utils/ensure-command-access.js';
import { config } from '../../config/index.js';
import { RegisterService } from '../../services/register.service.js';
import client from '../../client.js';
import { ADMIN_SUBCOMMANDS, COMMAND_NAMES } from '../../config/constants.js';
import { buildManualRegisterSubcommand, executeManualRegisterSubcommand } from './manual-register.js';
import { buildLookupDiscordSubcommand, executeLookupDiscordSubcommand } from './lookup-discord.js';
import { buildLookupLinkedAccountSubcommand, executeLookupLinkedAccountSubcommand } from './lookup-linked-account.js';

const services = new RegisterService(client);

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.admin)
  .setDescription('Administrative auth commands.')
  .addSubcommand(buildManualRegisterSubcommand)
  .addSubcommand(buildLookupDiscordSubcommand)
  .addSubcommand(buildLookupLinkedAccountSubcommand);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const allowed = await ensureCommandAccess(interaction, {
    allowedChannelIds: [config.discord.channels.botCommands],
    requiredRoleIds: [config.discord.roles.moderator],
    allowDeveloperOverride: true,
  });
  if (!allowed) return;

  const subcommand = interaction.options.getSubcommand(true);
  switch (subcommand) {
    case ADMIN_SUBCOMMANDS.manualRegister:
      await executeManualRegisterSubcommand(interaction, services);
      return;
    case ADMIN_SUBCOMMANDS.lookupDiscord:
      await executeLookupDiscordSubcommand(interaction, services);
      return;
    case ADMIN_SUBCOMMANDS.lookupLinkedAccount:
      await executeLookupLinkedAccountSubcommand(interaction, services);
      return;
    default:
      await interaction.reply({ content: 'Unsupported admin subcommand.', ephemeral: true });
  }
}
