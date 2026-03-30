import { EmbedBuilder, type Client } from 'discord.js';
import type { RegistrationSessionStatusResponse, RoleIntent } from '../api/types.js';
import { config } from '../config/index.js';
import type { SupportedGame } from '../config/types.js';
import {
  extractAuthenticationSnapshot,
  formatAppliedRoleUpdates,
  formatDiscordAccount,
  formatGameLabel,
  formatSteamAccount,
} from '../ui/formatters/registration-display.js';
import { toSystemErrorSummary } from '../utils/error-message.js';

export class AuthLogService {
  constructor(private readonly client: Client) {}

  async logSuccessfulAuthentication(input: {
    userId: string;
    session: RegistrationSessionStatusResponse;
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.authLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const snapshot = extractAuthenticationSnapshot(input.session);
    const embed = new EmbedBuilder()
      .setTitle('🔹 Authentication completed')
      .addFields(
        {
          name: 'Discord',
          value:
            `Display name: **${snapshot.displayName}**\n` +
            `Username: **${snapshot.username}**\n` +
            `Discord ID: \`${input.userId}\`\n` +
            `Locale: \`${snapshot.locale}\`\n` +
            `Verified: ${snapshot.verified}\n` +
            `MFA: ${snapshot.mfaEnabled}`,
        },
        {
          name: 'Steam',
          value:
            `Username: **${snapshot.steamName}**\n` +
            `Steam ID: \`${snapshot.steamId}\`\n` +
            `Game: **${formatGameLabel(input.session.game ?? 'civ6')}**`,
        },
      );

    await channel.send({ embeds: [embed] });
  }

  async logRegistrationResult(input: {
    actorId: string;
    subjectId: string;
    game: SupportedGame;
    steamId: string;
    steamName?: string | null;
    appliedRoleIntents: readonly RoleIntent[];
    mode: 'self-service' | 'manual';
    usernameSnapshot?: string | null;
    displayNameSnapshot?: string | null;
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.registrationLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(input.mode === 'manual' ? '✅ Manual registration completed' : '✅ Registration completed')
      .addFields(
        {
          name: 'Discord account',
          value: formatDiscordAccount({
            discordId: input.subjectId,
            displayName: input.displayNameSnapshot,
            username: input.usernameSnapshot,
          }),
        },
        {
          name: 'Steam account',
          value: formatSteamAccount({ steamId: input.steamId, steamName: input.steamName }),
        },
        { name: 'Game', value: formatGameLabel(input.game), inline: true },
        {
          name: 'Discord role updates',
          value: formatAppliedRoleUpdates(input.appliedRoleIntents),
        },
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
