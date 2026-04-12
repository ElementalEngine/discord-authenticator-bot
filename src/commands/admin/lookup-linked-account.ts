import { MessageFlags, SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildLinkedAccountLookupEmbed } from '../../ui/embeds/register.js';
import { toUserErrorMessage } from '../../utils/error-message.js';
import type { RegisterService } from '../../services/register.service.js';

export function buildLookupLinkedAccountSubcommand(): SlashCommandSubcommandBuilder {
  return new SlashCommandSubcommandBuilder()
    .setName('lookup-linked-account')
    .setDescription('Look up every Discord account tied to a linked account ID.')
    .addStringOption((option) =>
      option.setName('linked-account-id').setDescription('Linked account ID').setRequired(true),
    );
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
    await interaction.editReply({ embeds: [buildLinkedAccountLookupEmbed(account)] });
  } catch (error) {
    await interaction.editReply({ content: toUserErrorMessage(error) });
    await services.logs.logSystemError({
      title: 'Lookup by linked account ID failed',
      actorId: interaction.user.id,
      error,
    });
  }
}
