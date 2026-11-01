import type { Client } from 'discord.js';

import type { Registration, RoleIntent, Standing } from '../api/types.js';
import { GAME_NAMES } from '../config/constants.js';
import { config } from '../config/index.js';
import { account, role, standing as standingParts, who } from '../ui/format.js';
import { log } from '../utils/log.js';

// One staff channel, one plain-text line per event: a tag first, so staff can
// search for it, and Discord's search reads plain text without exception.
export type Entry = Readonly<{ text: string; pingModerators: boolean }>;

export type Via = 'steam' | '2k' | 'staff' | 'rank role';

const VIA: Readonly<Record<Via, string>> = {
  steam: 'Steam sign-in',
  '2k': '2K, self-registered',
  staff: 'manual registration',
  'rank role': 'second rank role',
};

const FLAG_TEXT: Readonly<Record<string, string>> = {
  young_discord: 'Discord account under 7 days old',
  young_steam: 'Steam account under 30 days old',
  unknown_steam_age: "Steam won't show the account's age",
};

const LIMIT = 2000;
const DOT = ' · ';

// What staff must do by hand for roles a sync could not set.
function byHand(failed: readonly RoleIntent[]): string {
  const add = failed.filter((intent) => intent !== 'remove_non_verified');
  return [...(add.length ? [`add ${add.map(role).join(', ')}`] : []), ...(failed.includes('remove_non_verified') ? [`remove ${role('remove_non_verified')}`] : [])].join(' and ');
}

export function registered(
  registration: Registration,
  via: Via,
  failed: readonly RoleIntent[],
  staff?: Readonly<{ id: string; reason?: string | null }>,
): Entry[] {
  const id = registration.discord_user_id;
  const parts = [`[REGISTERED] ${who(id)}`, GAME_NAMES[registration.game], account(registration.linked_platform, registration.linked_account_id, registration.linked_account_name), VIA[via]];
  if (staff) parts.push(`by ${who(staff.id)}`, `reason: ${staff.reason?.trim() || 'none given'}`);
  const entries: Entry[] = [{ text: parts.join(DOT), pingModerators: false }];
  if (registration.flags.length) {
    entries.push({ text: `[YOUNG-ACCOUNT] ${who(id)}${DOT}${registration.flags.map((flag) => FLAG_TEXT[flag] ?? flag).join(DOT)}`, pingModerators: false });
  }
  if (failed.length) entries.push({ text: `[ERROR] ${who(id)}${DOT}roles not set after a retry: ${byHand(failed)} by hand`, pingModerators: false });
  return entries;
}

export type Clash = Readonly<{
  existing_discord_id?: string;
  standing?: Standing | null;
  platform?: string;
  steam_id?: string;
  account_id?: string;
  existing_steam_id?: string;
}>;

// banned is null when the bot could not read the server's bans. Moderators are
// pinged only when the other account is banned, suspended or at the threshold.
export function clash(userId: string, code: string, details: Clash, banned: boolean | null): Entry {
  const other = details.existing_discord_id && details.existing_discord_id !== userId ? details.existing_discord_id : null;
  const severe = Boolean(other && (banned || details.standing?.suspended || details.standing?.at_ban_threshold));
  const parts = [`[CLASH]${severe ? ` <@&${config.roles.moderator}>` : ''} ${who(userId)}`];
  if (other) {
    parts.push(`${account(details.steam_id ? 'steam' : details.platform, details.steam_id ?? details.account_id ?? '?')} is held by ${who(other)}`);
    if (details.standing) parts.push(...standingParts(details.standing));
    if (banned) parts.push('banned from the server');
    if (banned === null) parts.push('server ban unknown (no Ban Members permission)');
  } else {
    const held = details.existing_steam_id ? account('steam', details.existing_steam_id) : 'a different account';
    parts.push(`this Discord account is already linked to ${held}`);
  }
  parts.push(code);
  return { text: parts.join(DOT), pingModerators: severe };
}

export function error(userId: string, action: string, detail: string): Entry {
  return { text: `[ERROR] ${who(userId)}${DOT}could not ${action}${DOT}${detail}`, pingModerators: false };
}

// Posts each entry; a log that cannot be written is logged, never thrown.
export async function post(client: Client, entries: readonly Entry[]): Promise<void> {
  if (!entries.length) return;
  try {
    const channel = await client.channels.fetch(config.channels.log);
    if (!channel?.isSendable()) throw new Error('the log channel is not a text channel the bot can write to');
    for (const entry of entries) {
      const text = entry.text.length <= LIMIT ? entry.text : `${entry.text.slice(0, LIMIT - 1)}…`;
      await channel.send({ content: text, allowedMentions: entry.pingModerators ? { roles: [config.roles.moderator] } : { parse: [] } });
    }
  } catch (failure) {
    log.error('staff log not written', failure, entries.map((entry) => entry.text));
  }
}
