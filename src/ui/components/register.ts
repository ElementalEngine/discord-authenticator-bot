import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { BUTTON_IDS, MODAL_FIELD_IDS, MODAL_IDS } from '../../config/constants.js';

export function buildRegistrationButtons(input: {
  authorizeUrl: string;
  sessionId: string;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Start Discord verification')
      .setStyle(ButtonStyle.Link)
      .setURL(input.authorizeUrl),
    new ButtonBuilder()
      .setCustomId(`${BUTTON_IDS.registrationCancelPrefix}${input.sessionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildCiv7MethodButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.civ7MethodSteam)
      .setLabel('Steam API Auth')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.civ7MethodManual)
      .setLabel('Manual Register')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildSelfServiceManualModal(): ModalBuilder {
  const accountId = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.twoKAccountId)
    .setLabel('2K account ID')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(128);

  const accountName = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.twoKAccountName)
    .setLabel('2K account name (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(128);

  return new ModalBuilder()
    .setCustomId(MODAL_IDS.civ7SelfServiceManual)
    .setTitle('Register Civ 7 (2K)')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(accountId),
      new ActionRowBuilder<TextInputBuilder>().addComponents(accountName),
    );
}

export function clearComponents(): [] {
  return [];
}
