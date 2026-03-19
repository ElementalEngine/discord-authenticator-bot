import { Events, type Interaction } from 'discord.js';
import client from '../client.js';
import { handleRegisterInteraction } from '../interactions/register.interactions.js';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isButton()) {
    await handleRegisterInteraction(interaction, client);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Command not found.', ephemeral: true });
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    const content = 'There was an unexpected error while running this command.';
    if (interaction.deferred) {
      await interaction.editReply({ content }).catch(() => undefined);
      return;
    }
    if (interaction.replied) {
      await interaction.followUp({ content, ephemeral: true }).catch(() => undefined);
      return;
    }
    await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
  }
}
