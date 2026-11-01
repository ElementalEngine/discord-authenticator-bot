import { InteractionContextType, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import { api } from '../api/client.js';
import { refuse } from '../ui/failure.js';
import * as panels from '../ui/panels.js';
import { defer, show } from '../ui/reply.js';
import { SNOWFLAKE } from '../config/index.js';
import { gate } from './gate.js';

export const data = new SlashCommandBuilder()
  .setName('lookup')
  .setDescription('Staff: who holds a Discord id or a linked account.')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('What the value is')
      .setRequired(true)
      .addChoices({ name: 'Discord id', value: 'discord' }, { name: 'Steam or 2K account id', value: 'linked' }),
  )
  .addStringOption((option) => option.setName('value').setDescription('The id to look up').setRequired(true).setMaxLength(128));

export async function run(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  gate(interaction, 'lookup');
  const type = interaction.options.getString('type', true);
  const value = interaction.options.getString('value', true).trim();
  if (!value) refuse('Enter an id to look up.');
  if (type === 'discord' && !SNOWFLAKE.test(value)) refuse('A Discord id is 17 to 20 digits.');
  await defer(interaction);
  const result = type === 'discord' ? await api.lookupDiscord(value) : await api.lookupLinked(value);
  await show(interaction, panels.lookup(result, value));
}
