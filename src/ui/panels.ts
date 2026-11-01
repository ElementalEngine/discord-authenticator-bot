import { ButtonBuilder, ButtonStyle } from 'discord.js';

import type { AccountLookup, AccountRecord, Game, Registration } from '../api/types.js';
import { GAME_NAMES, IDS } from '../config/constants.js';
import type { RoleSync } from '../services/roles.js';
import { account, granted, role, standing, when } from './format.js';
import { notice, type Panel } from './kit.js';

// The sign-in's Cancel names its session, so an old message cannot stop a newer sign-in.
const cancelId = (sessionId: string): string => `${IDS.cancel}:${sessionId}`;
export const sessionOfCancel = (customId: string): string | null => (customId.startsWith(`${IDS.cancel}:`) ? customId.slice(IDS.cancel.length + 1) : null);

export const signIn = (game: Game, authorizeUrl: string, sessionId: string, endsAt: number): Panel => ({
  tone: 'info',
  title: `Register for ${GAME_NAMES[game]}`,
  lines: [
    '**1.** In Discord, open **Settings → Connections**, link your Steam account and turn on **Display on profile**.',
    '**2.** On Steam, set **Game details** to **Public** so we can see you own the game and your playtime.',
    '**3.** Press **Sign in with Discord** and finish in your browser. This message updates by itself.',
  ],
  buttons: [
    new ButtonBuilder().setLabel('Sign in with Discord').setStyle(ButtonStyle.Link).setURL(authorizeUrl),
    new ButtonBuilder().setCustomId(cancelId(sessionId)).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  ],
  footer: `This link expires ${when(new Date(endsAt).toISOString(), 'R')}.`,
});

export const chooseCiv7: Panel = {
  tone: 'info',
  title: `Register for ${GAME_NAMES.civ7}`,
  lines: ['**Steam:** sign in with Discord and we check your Steam account for you.', '**2K:** play through 2K? Enter your 2K account id instead.'],
  buttons: [
    new ButtonBuilder().setCustomId(IDS.civ7Steam).setLabel('Steam').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(IDS.civ7TwoK).setLabel('2K').setStyle(ButtonStyle.Secondary),
  ],
};

export const checking = (game: Game): Panel => notice('working', `Signed in. Checking your Steam account for ${GAME_NAMES[game]}…`);
export const expired: Panel = notice('refused', 'This sign-in expired. Run `/register` to start again.');
export const cancelled: Panel = notice('info', 'Cancelled. Run `/register` whenever you are ready.');
export const restarting: Panel = notice('refused', 'The bot restarted before your sign-in finished. Run `/register` to start again.');

// Staff registering someone else read about that player, not themselves.
function roleLines(sync: RoleSync, staff = false): string[] {
  const given = granted(sync.applied);
  const lines = [given.length ? `Roles: ${given.map(role).join(' ')}` : staff ? 'Their roles were already set.' : 'Your roles were already set.'];
  if (sync.failed.length) lines.push(staff ? 'Some roles could not be set. The staff log says which to set by hand.' : 'Some roles could not be set. Staff have been told and will sort them out.');
  return lines;
}

const toneOf = (sync: RoleSync): Panel['tone'] => (sync.failed.length ? 'refused' : 'success');

export const registered = (registration: Registration, sync: RoleSync): Panel => ({
  tone: toneOf(sync),
  title: `Registered for ${GAME_NAMES[registration.game]}`,
  lines: [`Account: ${account(registration.linked_platform, registration.linked_account_id, registration.linked_account_name)}`, ...roleLines(sync), 'Welcome to the league!'],
});

export const rankRole = (registration: Registration, sync: RoleSync): Panel => ({
  tone: toneOf(sync),
  title: `${GAME_NAMES[registration.game]} added`,
  lines: roleLines(sync),
});

export const registeredBy = (registration: Registration, sync: RoleSync): Panel => ({
  tone: toneOf(sync),
  title: `Registered for ${GAME_NAMES[registration.game]}`,
  lines: [
    `Player: <@${registration.discord_user_id}>`,
    `Account: ${account(registration.linked_platform, registration.linked_account_id, registration.linked_account_name)}`,
    ...roleLines(sync, true),
  ],
});

function recordLines(record: AccountRecord): string[] {
  const name = record.discord_display_name ?? record.discord_username;
  const lines = [`### <@${record.discord_id}> \`${record.discord_id}\`${name ? ` (${name})` : ''}`];
  if (record.linked_account_id) lines.push(`Account: ${account(record.linked_platform, record.linked_account_id, record.linked_account_name)}`);
  for (const entry of record.registrations) {
    const parts = [`${GAME_NAMES[entry.game]}: ${entry.method ?? 'unknown method'}`];
    if (entry.registered_at) parts.push(when(entry.registered_at, 'D'));
    if (entry.actor_discord_id) parts.push(`by <@${entry.actor_discord_id}>`);
    if (entry.reason) parts.push(`"${entry.reason}"`);
    if (entry.flags.length) parts.push(entry.flags.join(', '));
    lines.push(`- ${parts.join(' · ')}`);
  }
  if (record.standing) lines.push(standing(record.standing).join(' · ') || 'Not suspended');
  return lines;
}

// Staff only: a lookup shows standing, reasons and who registered by hand.
export const lookup = (result: AccountLookup, query: string): Panel => ({
  tone: result.records.length > 1 ? 'refused' : 'info',
  title: `Lookup: \`${query}\``,
  lines: result.records.length
    ? [...(result.records.length > 1 ? [`‼️ ${result.records.length} records hold this id. Worth a look.`] : []), ...result.records.flatMap(recordLines)]
    : ['No records hold this id.'],
});
