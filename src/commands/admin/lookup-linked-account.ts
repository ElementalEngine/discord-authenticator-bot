import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLookupLinkedAccountEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import { logAuthCommandFailure } from '../../utils/auth-command-failure.js';
import type { RegisterService } from '../../services/register.service.js';

export function buildLookupLinkedAccountSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('lookup-linked-account')
    .setDescription('Look up an account by linked account ID.')
    .addStringOption((option) => option.setName('linked-account-id').setDescription('Linked account ID').setRequired(true));
}

export async function executeLookupLinkedAccountSubcommand(
  interaction: ChatInputCommandInteraction,
  services: RegisterService,
): Promise<void> {
  const linkedAccountId = interaction.options.getString('linked-account-id', true).trim();

  if (!linkedAccountId) {
    await interaction.reply({ content: 'Linked account ID must not be blank.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const account = await services.lookupByLinkedAccountId(linkedAccountId);
    await interaction.editReply({ embeds: [buildLookupLinkedAccountEmbed(account)] });
  } catch (error) {
    const userMessage = toUserErrorMessage(error);
    await interaction.editReply({ content: userMessage });
    await logAuthCommandFailure({
      logs: services.logs,
      title: 'Lookup by linked account ID failed',
      actorId: interaction.user.id,
      error,
      userMessage,
      context: { linked_account_id: linkedAccountId },
    });
  }
}
