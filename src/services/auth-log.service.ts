import { EmbedBuilder, type Client } from 'discord.js';
import type { RegistrationPlatform, RoleIntent } from '../api/types.js';
import { config } from '../config/index.js';
import { EMOJIS } from '../config/constants.js';
import type { SupportedGame } from '../config/types.js';
import { toSystemErrorSummary } from '../utils/error-message.js';
import {
  formatDiscordAccountBlock,
  formatGameLabel,
  formatLinkedAccountBlock,
  formatLinkedAccountHeading,
  formatRoleUpdateLines,
} from '../ui/formatters/registration-display.js';

export class AuthLogService {
  constructor(private readonly client: Client) {}

  async logAuthenticationCompleted(input: {
    discordId: string;
    discordDisplayName?: string | null;
    discordUsername?: string | null;
    locale?: string | null;
    verified?: boolean | null;
    mfaEnabled?: boolean | null;
    steamId: string;
    steamName?: string | null;
    game: SupportedGame;
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.authLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.detail} Authentication completed`)
      .addFields(
        {
          name: 'Discord',
          value: [
            formatDiscordAccountBlock({
              displayName: input.discordDisplayName,
              username: input.discordUsername,
              discordId: input.discordId,
            }),
            `Locale: ${input.locale?.trim() ? `\`${input.locale.trim()}\`` : 'Unknown'}`,
            `Verified: ${formatBoolean(input.verified)}`,
            `MFA: ${formatBoolean(input.mfaEnabled, { trueLabel: 'Enabled', falseLabel: 'Disabled' })}`,
          ].join('\n'),
        },
        {
          name: 'Steam',
          value: [
            formatLinkedAccountBlock({ platform: 'steam', username: input.steamName, accountId: input.steamId }),
            `Game: ${formatGameLabel(input.game)}`,
          ].join('\n'),
        },
      );

    await channel.send({ embeds: [embed] });
  }

  async logManualRegistrationCompleted(input: {
    actorId: string;
    subjectId: string;
    discordDisplayName?: string | null;
    discordUsername?: string | null;
    linkedPlatform: RegistrationPlatform;
    accountId: string;
    accountName?: string | null;
    game: SupportedGame;
    reason: string;
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.authLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.detail} Manual registration completed`)
      .addFields(
        {
          name: 'Discord',
          value: formatDiscordAccountBlock({
            displayName: input.discordDisplayName,
            username: input.discordUsername,
            discordId: input.subjectId,
          }),
        },
        {
          name: formatLinkedAccountHeading(input.linkedPlatform),
          value: [
            formatLinkedAccountBlock({ platform: input.linkedPlatform, username: input.accountName, accountId: input.accountId }),
            `Game: ${formatGameLabel(input.game)}`,
          ].join('\n'),
        },
        {
          name: 'Action',
          value: [`Performed by: <@${input.actorId}>`, `Reason: ${input.reason}`].join('\n'),
        },
      );

    await channel.send({ embeds: [embed] });
  }

  async logRegistrationResult(input: {
    actorId: string;
    subjectId: string;
    discordDisplayName?: string | null;
    discordUsername?: string | null;
    game: SupportedGame;
    linkedPlatform: RegistrationPlatform;
    accountId: string;
    accountName?: string | null;
    appliedRoleIntents: readonly RoleIntent[];
    mode: 'self-service' | 'manual';
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.registrationLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(input.mode === 'manual' ? `${EMOJIS.success} Manual registration completed` : `${EMOJIS.success} Registration completed`)
      .addFields(
        {
          name: 'Discord account',
          value: formatDiscordAccountBlock({
            displayName: input.discordDisplayName,
            username: input.discordUsername,
            discordId: input.subjectId,
          }),
        },
        {
          name: formatLinkedAccountHeading(input.linkedPlatform),
          value: formatLinkedAccountBlock({ platform: input.linkedPlatform, username: input.accountName, accountId: input.accountId }),
        },
        { name: 'Game', value: formatGameLabel(input.game) },
        { name: 'Discord role updates', value: formatRoleUpdateLines(input.appliedRoleIntents) },
        ...buildPerformedByField(input.actorId, input.subjectId),
      );

    await channel.send({ embeds: [embed] });
  }

  async logRankRoleResult(input: {
    actorId: string;
    subjectId: string;
    discordDisplayName?: string | null;
    discordUsername?: string | null;
    game: SupportedGame;
    appliedRoleIntents: readonly RoleIntent[];
  }): Promise<void> {
    const channel = await this.client.channels.fetch(config.discord.channels.registrationLog).catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.success} Ranked role updated`)
      .addFields(
        {
          name: 'Discord account',
          value: formatDiscordAccountBlock({
            displayName: input.discordDisplayName,
            username: input.discordUsername,
            discordId: input.subjectId,
          }),
        },
        { name: 'Game', value: formatGameLabel(input.game) },
        { name: 'Discord role updates', value: formatRoleUpdateLines(input.appliedRoleIntents) },
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
      .addFields(...buildSystemActorFields(input.actorId, input.subjectId));

    await channel.send({ embeds: [embed] });
  }
}

function buildPerformedByField(actorId: string, subjectId: string): Array<{ name: string; value: string; inline?: boolean }> {
  return actorId !== subjectId ? [{ name: 'Performed by', value: `<@${actorId}>` }] : [];
}

function buildSystemActorFields(
  actorId?: string,
  subjectId?: string,
): Array<{ name: string; value: string; inline?: boolean }> {
  if (actorId && subjectId && actorId !== subjectId) {
    return [
      { name: 'Performed by', value: `<@${actorId}>`, inline: true },
      { name: 'Subject', value: `<@${subjectId}>`, inline: true },
    ];
  }
  if (subjectId) {
    return [{ name: 'User', value: `<@${subjectId}>`, inline: true }];
  }
  if (actorId) {
    return [{ name: 'User', value: `<@${actorId}>`, inline: true }];
  }
  return [];
}

function formatBoolean(
  value: boolean | null | undefined,
  labels: { trueLabel?: string; falseLabel?: string } = {},
): string {
  if (value === true) return labels.trueLabel ?? 'Yes';
  if (value === false) return labels.falseLabel ?? 'No';
  return 'Unknown';
}
