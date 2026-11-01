import { DiscordAPIError, RESTJSONErrorCodes, type Guild, type GuildMember } from 'discord.js';

import { ApiError } from '../api/errors.js';
import type { Registration } from '../api/types.js';
import { syncRoles, type RoleSync } from '../services/roles.js';
import * as staffLog from '../services/staff-log.js';
import { failureOf } from '../ui/failure.js';
import { notice, type Panel } from '../ui/kit.js';
import { log } from '../utils/log.js';

const CLASHES = new Set(['STEAM_ID_CONFLICT', 'LINKED_ACCOUNT_CONFLICT', 'DISCORD_ID_CONFLICT']);

// Sets a new registration's roles and tells staff.
export async function settle(
  guild: Guild,
  member: GuildMember,
  registration: Registration,
  via: staffLog.Via,
  staff?: Readonly<{ id: string; reason?: string | null }>,
): Promise<RoleSync> {
  const sync = await syncRoles(member, registration.role_intents);
  await staffLog.post(guild.client, staffLog.registered(registration, via, sync.failed, staff));
  return sync;
}

// Whether a user is banned from the server, or null when the bot may not read bans.
async function serverBan(guild: Guild, userId: string): Promise<boolean | null> {
  try {
    await guild.bans.fetch({ user: userId, force: true });
    return true;
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownBan) return false;
    log.warn('server bans not readable', error instanceof Error ? error.message : error);
    return null;
  }
}

const describe = (error: unknown): string => {
  if (error instanceof ApiError) return `${error.code ?? 'HTTP'} (${error.status})${error.error?.correlation_id ? ` ref ${error.error.correlation_id}` : ''}`;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
};

// What the person who acted reads; staff hear of a clash, and of any fault of ours.
export async function failed(guild: Guild, userId: string, error: unknown, action: string): Promise<Panel> {
  const failure = failureOf(error);
  if (error instanceof ApiError && error.code && CLASHES.has(error.code)) {
    const details = (error.error?.details ?? {}) as staffLog.Clash;
    const other = details.existing_discord_id;
    const banned = other && other !== userId ? await serverBan(guild, other) : false;
    await staffLog.post(guild.client, [staffLog.clash(userId, error.code, details, banned)]);
  } else if (failure.staff) {
    log.error(`could not ${action} for ${userId}`, error);
    await staffLog.post(guild.client, [staffLog.error(userId, action, describe(error))]);
  }
  return notice(failure.tone, failure.text);
}
