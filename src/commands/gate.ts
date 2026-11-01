import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';

import { refusalFor, type Leaf } from '../config/access.js';
import type { Game } from '../api/types.js';
import { refuse } from '../ui/failure.js';

export const GAME_CHOICES = [
  { name: 'Civilization VI', value: 'civ6' },
  { name: 'Civilization VII', value: 'civ7' },
] as const satisfies readonly { name: string; value: Game }[];

// Stops a command, or a press on its message, before any work when this member may not run it here.
export function gate(interaction: Readonly<{ channelId: string | null; member: GuildMember }>, leaf: Leaf): void {
  const reason = refusalFor(leaf, interaction.channelId ?? '', interaction.member.roles.cache);
  if (reason) refuse(reason);
}

export function gameOption(interaction: ChatInputCommandInteraction<'cached'>): Game {
  const value = interaction.options.getString('game', true);
  return value === 'civ6' || value === 'civ7' ? value : refuse('Pick a game from the list.');
}
