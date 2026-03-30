import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BUTTON_IDS } from '../../config/constants.js';

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

export function clearComponents() {
  return [];
}
