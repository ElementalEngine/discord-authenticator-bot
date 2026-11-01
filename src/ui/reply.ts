import {
  MessageFlags,
  type ButtonInteraction,
  type ModalMessageModalSubmitInteraction,
  type MessageEditOptions,
  type RepliableInteraction,
} from 'discord.js';

import { log } from '../utils/log.js';
import { container, type Panel } from './kit.js';

// Every answer is private to the person who acted, and pings no one.
const NO_PINGS = { parse: [] };
const PRIVATE = [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as const;

const asEdit = (panel: Panel): MessageEditOptions => ({
  content: null,
  embeds: [],
  flags: MessageFlags.IsComponentsV2,
  components: [container(panel)],
  allowedMentions: NO_PINGS,
});

export async function defer(interaction: RepliableInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

// Answers the interaction, or rewrites its answer. Never throws: the
// interaction may have expired or its message been dismissed.
export async function show(interaction: RepliableInteraction, panel: Panel): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply(asEdit(panel));
    else await interaction.reply({ flags: PRIVATE, components: [container(panel)], allowedMentions: NO_PINGS });
  } catch (error) {
    log.warn('reply not delivered', error instanceof Error ? error.message : error);
  }
}

// A press or form acknowledged now, its message rewritten later with show().
export async function hold(interaction: ButtonInteraction | ModalMessageModalSubmitInteraction): Promise<void> {
  await interaction.deferUpdate();
}

// A button answered by redrawing the message it sits on.
export async function redraw(interaction: ButtonInteraction, panel: Panel): Promise<void> {
  try {
    await interaction.update(asEdit(panel));
  } catch (error) {
    log.warn('reply not delivered', error instanceof Error ? error.message : error);
  }
}
