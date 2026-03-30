import { EmbedBuilder, type Client } from 'discord.js';
import type { RegistrationSessionStatusResponse, RoleIntent } from '../api/types.js';
import { config } from '../config/index.js';
import type { SupportedGame } from '../config/types.js';
import { extractAuthenticationSnapshot, formatAppliedRoleUpdates, formatGameLabel, formatSteamAccount } from '../ui/formatters/registration-display.js';
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
      .setTitle('🔹 User successfully authenticated')
      .addFields(
        { name: 'User', value: `<@${input.userId}>`, inline: true },
        { name: 'Discord ID', value: `\`${input.userId}\``, inline: true },
        { name: 'Steam account', value: snapshot.steamAccount },
        { name: 'Username', value: snapshot.username, inline: true },
        { name: 'Display name', value: snapshot.displayName, inline: true },
        { name: 'Email', value: snapshot.email, inline: true },
        { name: 'Verified', value: snapshot.verified, inline: true },
        { name: 'Locale', value: snapshot.locale, inline: true },
        { name: 'MFA enabled', value: snapshot.mfaEnabled, inline: true },
        { name: 'Nitro status', value: snapshot.nitroStatus, inline: true },
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
      .setTitle('✅ New registration completed')
      .setDescription(
        input.mode === 'manual'
          ? 'A manual auth registration was completed successfully.'
          : 'A self-service auth registration was completed successfully.',
      )
      .addFields(
        { name: 'Member', value: `<@${input.subjectId}>`, inline: true },
        ...(input.actorId !== input.subjectId ? [{ name: 'Completed by', value: `<@${input.actorId}>`, inline: true }] : []),
        { name: 'Game', value: formatGameLabel(input.game), inline: true },
        { name: 'Steam account', value: formatSteamAccount({ steamId: input.steamId, steamName: input.steamName }) },
        {
          name: 'Discord updates',
          value: formatAppliedRoleUpdates(input.appliedRoleIntents),
        },
        {
          name: 'Discord identity',
          value:
            `Username: ${input.usernameSnapshot ?? 'Unknown'}\n` +
            `Display name: ${input.displayNameSnapshot ?? 'Unknown'}\n` +
            `Discord ID: \`${input.subjectId}\``,
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
