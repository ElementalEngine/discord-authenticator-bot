import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ID } from './env.js';

const log = await import('../src/services/staff-log.js');

const player = '300000000000000001';
const other = '300000000000000002';
const steam = '76561198000000001';
const standing = (over: Partial<{ suspended: boolean; at_ban_threshold: boolean; tiers: Record<string, number> }> = {}) => ({
  suspended: false,
  at_ban_threshold: false,
  tiers: {},
  ...over,
});
const moderator = `<@&${ID.ROLE_MODERATOR}>`;

test('a clash pings moderators only when the other account is suspended, at the threshold or banned', () => {
  const held = { existing_discord_id: other, steam_id: steam };
  const cases: [Parameters<typeof log.clash>[2], boolean | null, boolean][] = [
    [{ ...held, standing: standing() }, false, false],
    [{ ...held, standing: standing({ suspended: true }) }, false, true],
    [{ ...held, standing: standing({ at_ban_threshold: true }) }, false, true],
    [{ ...held, standing: null }, true, true],
    [{ ...held, standing: null }, null, false],
  ];
  for (const [details, banned, ping] of cases) {
    const entry = log.clash(player, 'STEAM_ID_CONFLICT', details, banned);
    assert.equal(entry.pingModerators, ping, JSON.stringify({ details, banned }));
    assert.equal(entry.text.includes(moderator), ping);
    assert.ok(entry.text.startsWith('[CLASH]'));
  }
});

test("a clash names the other account and its standing, for staff only", () => {
  const entry = log.clash(player, 'STEAM_ID_CONFLICT', { existing_discord_id: other, steam_id: steam, standing: standing({ suspended: true, tiers: { cheating: 2, toxicity: 0 } }) }, false);
  assert.match(entry.text, new RegExp(`<@${other}>`));
  assert.match(entry.text, /suspended/);
  assert.match(entry.text, /cheating 2/);
  assert.doesNotMatch(entry.text, /toxicity/);
});

test('a registration logs one tagged line, plus young-account and role-failure lines when they apply', () => {
  const registration = {
    discord_user_id: player,
    game: 'civ7' as const,
    linked_platform: 'steam' as const,
    linked_account_id: steam,
    linked_account_name: 'Pat',
    registration_method: 'oauth_steam_api' as const,
    role_intents: [],
    flags: ['young_discord' as const],
  };
  const entries = log.registered(registration, 'staff', ['grant_civ7_rank', 'remove_non_verified'], { id: other, reason: 'family share' });
  assert.match(entries[0]!.text, new RegExp(` · manual registration · by <@${other}>`));
  assert.deepEqual(entries.map((entry) => entry.text.split(' ')[0]), ['[REGISTERED]', '[YOUNG-ACCOUNT]', '[ERROR]']);
  assert.match(entries[0]!.text, /reason: family share/);
  assert.match(entries[2]!.text, new RegExp(`add <@&${ID.ROLE_CIV7}> and remove <@&${ID.ROLE_NON_VERIFIED}> by hand`));
  assert.ok(entries.every((entry) => !entry.pingModerators));
  assert.equal(log.registered({ ...registration, flags: [] }, 'steam', []).length, 1);
});

test('a clash on the player\'s own account names the account they hold, no one else, and pings no one', () => {
  const entry = log.clash(player, 'LINKED_ACCOUNT_CONFLICT', { existing_discord_id: player, platform: '2k', account_id: 'abc', standing: standing({ suspended: true }) }, true);
  assert.equal(entry.pingModerators, false);
  assert.match(entry.text, /already linked to .*abc/);
  assert.doesNotMatch(entry.text, /is held by|a different account/);
});
