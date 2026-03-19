import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageEditOptions,
} from 'discord.js';

export async function safeReply(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }
  await interaction.reply(payload);
}

export async function safeEditReply(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  payload: string | MessageEditOptions | InteractionUpdateOptions,
): Promise<void> {
  if (typeof payload === 'string') {
    await interaction.editReply({ content: payload });
    return;
  }
  await interaction.editReply(payload);
}

