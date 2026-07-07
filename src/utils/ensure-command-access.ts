import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { config } from '../config/index.js';
import type { CommandAccessPolicy } from '../config/types.js';
import { SNOWFLAKE_RE } from './patterns.js';

function uniqSnowflakes(ids: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (id && SNOWFLAKE_RE.test(id)) seen.add(id);
  }
  return [...seen];
}

function getMemberRoleIds(interaction: ChatInputCommandInteraction): Set<string> | null {
  if (!interaction.inGuild()) return null;
  if (interaction.inCachedGuild()) {
    return new Set(interaction.member.roles.cache.keys());
  }
  const member = interaction.member;
  if (member && typeof member === 'object' && 'roles' in member) {
    const roles = (member as { roles?: unknown }).roles;
    if (Array.isArray(roles) && roles.every((entry) => typeof entry === 'string')) {
      return new Set(roles);
    }
  }
  return null;
}

async function replyEphemeral(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply({ content, allowedMentions: { parse: [] } });
    return;
  }
  if (interaction.replied) {
    await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }
  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export async function ensureCommandAccess(
  interaction: ChatInputCommandInteraction,
  policy: CommandAccessPolicy,
): Promise<boolean> {
  if (!interaction.inGuild()) {
    await replyEphemeral(interaction, 'This command must be used in a server.');
    return false;
  }

  const allowedChannels = uniqSnowflakes(policy.allowedChannelIds);
  if (allowedChannels.length > 0 && !allowedChannels.includes(interaction.channelId)) {
    await replyEphemeral(
      interaction,
      `Use this command in: ${allowedChannels.map((id) => `<#${id}>`).join(', ')}`,
    );
    return false;
  }

  if (!policy.requiredRoleIds) return true;

  const roleIds = getMemberRoleIds(interaction);
  if (!roleIds) {
    await replyEphemeral(interaction, 'Unable to verify your roles right now.');
    return false;
  }

  const moderatorId = config.discord.roles.moderator;
  const developerId = policy.allowDeveloperOverride ? config.discord.roles.developer : undefined;
  if (moderatorId && roleIds.has(moderatorId)) return true;
  if (developerId && roleIds.has(developerId)) return true;

  const requiredRoles = uniqSnowflakes(policy.requiredRoleIds);
  if (!requiredRoles.some((roleId) => roleIds.has(roleId))) {
    await replyEphemeral(
      interaction,
      `Missing required role. Need one of: ${requiredRoles.map((id) => `<@&${id}>`).join(', ')}`,
    );
    return false;
  }

  return true;
}
