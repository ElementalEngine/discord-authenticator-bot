import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_NAMES, LOOKUP_TYPES, LOOKUP_TYPE_CHOICES } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { ensureCommandAccess } from '../../utils/ensure-command-access.js';
import { buildLookupDiscordEmbed, buildLookupLinkedAccountEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import { logAuthCommandFailure } from '../../utils/auth-command-failure.js';
import { RegisterService } from '../../services/register.service.js';
import client from '../../client.js';

const DISCORD_ID_RE = /^\d{17,20}$/;
const services = new RegisterService(client);

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.lookup)
  .setDescription('Staff: look up a registration by Discord ID or linked account ID.')
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('What to look up by')
      .setRequired(true)
      .addChoices(...LOOKUP_TYPE_CHOICES),
  )
  .addStringOption((option) =>
    option.setName('value').setDescription('The Discord ID or linked account ID to look up').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const allowed = await ensureCommandAccess(interaction, {
    allowedChannelIds: [config.discord.channels.botCommands],
    requiredRoleIds: [config.discord.roles.moderator],
    allowDeveloperOverride: true,
  });
  if (!allowed) return;

  const type = interaction.options.getString('type', true);
  const value = interaction.options.getString('value', true).trim();

  if (!value) {
    await interaction.reply({ content: 'Lookup value must not be blank.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (type === LOOKUP_TYPES.discordId && !DISCORD_ID_RE.test(value)) {
    await interaction.reply({ content: 'Discord ID must be numeric.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (type === LOOKUP_TYPES.discordId) {
      const account = await services.lookupByDiscordId(value);
      await interaction.editReply({ embeds: [buildLookupDiscordEmbed(account)] });
    } else {
      const account = await services.lookupByLinkedAccountId(value);
      await interaction.editReply({ embeds: [buildLookupLinkedAccountEmbed(account)] });
    }
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await interaction.editReply({ content: userMessage });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Account lookup failed',
      actorId: interaction.user.id,
      error,
      userMessage,
      context: { lookup_type: type, value },
    });
  }
}
