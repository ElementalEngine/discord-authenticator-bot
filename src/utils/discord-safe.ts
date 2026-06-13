import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionUpdateOptions,
  MessageEditOptions,
} from 'discord.js';


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