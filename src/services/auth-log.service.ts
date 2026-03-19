import { EmbedBuilder, type Client } from 'discord.js';
import type { RoleIntent } from '../api/types.js';
import { config } from '../config/index.js';
import { toSystemErrorSummary } from '../utils/error-message.js';

export class AuthLogService {
  constructor(private readonly client: Client) {}

  async logRegistrationResult(input: {
    actorId: string;
    subjectId: string;
    game: string;
    steamId: string;
    appliedRoleIntents: readonly RoleIntent[];
    mode: 'self-service' | 'manual';
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.registrationLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle('Auth registration completed')
      .addFields(
        { name: 'Mode', value: input.mode, inline: true },
        { name: 'Game', value: input.game.toUpperCase(), inline: true },
        { name: 'Actor', value: `<@${input.actorId}>`, inline: true },
        { name: 'Subject', value: `<@${input.subjectId}>`, inline: true },
        { name: 'Steam ID', value: `\`${input.steamId}\`` },
        { name: 'Applied intents', value: input.appliedRoleIntents.map((value) => `• ${value}`).join('\n') || 'None' },
      );

    await channel.send({ embeds: [embed] });
  }

  async logSystemError(input: {
    title: string;
    actorId?: string;
    subjectId?: string;
    error: unknown;
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.authLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(input.title)
      .setDescription(toSystemErrorSummary(input.error))
      .addFields(
        ...(input.actorId ? [{ name: 'Actor', value: `<@${input.actorId}>`, inline: true }] : []),
        ...(input.subjectId ? [{ name: 'Subject', value: `<@${input.subjectId}>`, inline: true }] : []),
      );

    await channel.send({ embeds: [embed] });
  }
}
