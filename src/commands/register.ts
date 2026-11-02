import {
  ActionRowBuilder,
  InteractionContextType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

import { api } from '../api/client.js';
import { IDS } from '../config/constants.js';
import { settle } from '../flows/outcome.js';
import { watch } from '../flows/steam.js';
import { refuse } from '../ui/failure.js';
import { notice } from '../ui/kit.js';
import * as panels from '../ui/panels.js';
import { defer, hold, redraw, show } from '../ui/reply.js';
import { GAME_CHOICES, gameOption, gate } from './gate.js';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register for the league, or add your second game.')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub.setName('civ6').setDescription('Register for Civilization VI with Steam.'))
  .addSubcommand((sub) => sub.setName('civ7').setDescription('Register for Civilization VII with Steam or 2K.'))
  .addSubcommand((sub) =>
    sub
      .setName('add-rank-role')
      .setDescription('Add your second game once you are registered.')
      .addStringOption((option) => option.setName('game').setDescription('The game to add').setRequired(true).addChoices(...GAME_CHOICES)),
  );

export async function run(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const sub = interaction.options.getSubcommand(true);
  if (sub !== 'civ6' && sub !== 'civ7' && sub !== 'add-rank-role') refuse('That option is gone. Run `/register` again.');
  gate(interaction, `register ${sub}`);
  if (sub === 'civ7') return show(interaction, panels.chooseCiv7);
  await defer(interaction);
  if (sub === 'civ6') return watch.start(interaction, interaction.member, 'civ6');
  const registration = await api.rankRole(interaction.user.id, gameOption(interaction));
  const sync = await settle(interaction.guild, interaction.member, registration, 'rank role');
  await show(interaction, panels.rankRole(registration, sync));
}

const twoK = new ModalBuilder()
  .setCustomId(IDS.twoKModal)
  .setTitle('Register for Civilization VII with 2K')
  .addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(IDS.twoKAccountId).setLabel('2K account id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(128),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(IDS.twoKAccountName).setLabel('2K account name (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(128),
    ),
  );

// The civ7 choice is an old message by the time it is pressed, so the access
// check runs again: a player registered since cannot use it.
export async function press(interaction: ButtonInteraction<'cached'>): Promise<void> {
  const id = interaction.customId;
  if (id === IDS.civ7Steam || id === IDS.civ7TwoK) gate(interaction, 'register civ7');
  if (id === IDS.civ7Steam) {
    await hold(interaction);
    return watch.start(interaction, interaction.member, 'civ7');
  }
  if (id === IDS.civ7TwoK) return interaction.showModal(twoK);
  const cancelled = panels.sessionOfCancel(id);
  if (cancelled) {
    if (watch.cancel(interaction.user.id, cancelled)) return redraw(interaction, panels.cancelled);
    return show(interaction, notice('info', 'Too late to cancel: your registration is being finished. The message above updates when it is done.'));
  }
  return show(interaction, notice('refused', 'This button has expired. Run `/register` again.'));
}

export async function submit(interaction: ModalSubmitInteraction<'cached'>): Promise<void> {
  if (interaction.customId !== IDS.twoKModal || !interaction.isFromMessage()) {
    return show(interaction, notice('refused', 'This form has expired. Run `/register` again.'));
  }
  gate(interaction, 'register civ7');
  const accountId = interaction.fields.getTextInputValue(IDS.twoKAccountId).trim();
  const accountName = interaction.fields.getTextInputValue(IDS.twoKAccountName).trim() || null;
  if (!accountId) refuse('Enter your 2K account id.');
  await hold(interaction);
  const registration = await api.registerTwoK({
    discord_user_id: interaction.user.id,
    platform_account_id: accountId,
    platform_account_name: accountName,
    discord_username: interaction.user.username,
    discord_display_name: interaction.member.displayName,
  });
  const sync = await settle(interaction.guild, interaction.member, registration, '2k');
  await show(interaction, panels.registered(registration, sync));
}
