import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ID } from './env.js';

const { syncRoles } = await import('../src/services/roles.js');

// A member whose role calls fail a set number of times per role.
function member(held: string[], failures: Record<string, number> = {}) {
  const roles = new Set(held);
  const calls: string[] = [];
  const act = (verb: 'add' | 'remove') => async (id: string): Promise<void> => {
    calls.push(`${verb} ${id}`);
    if ((failures[id] ?? 0) > 0) {
      failures[id]! -= 1;
      throw new Error('Missing Permissions');
    }
    if (verb === 'add') roles.add(id);
    else roles.delete(id);
  };
  return { id: '123456789012345678', roles: { cache: roles, add: act('add'), remove: act('remove') }, calls, held: roles };
}

test('adds what is missing, removes the non-verified role, and leaves what is already right', async () => {
  const m = member([ID.ROLE_NON_VERIFIED!, ID.ROLE_NOVICE!]);
  const sync = await syncRoles(m, ['grant_civ6_rank', 'grant_novice', 'grant_2k_crossplatform', 'remove_non_verified'], undefined, 0);
  assert.deepEqual(sync, { applied: ['grant_civ6_rank', 'remove_non_verified'], failed: [] });
  assert.deepEqual([...m.held].sort(), [ID.ROLE_CIV6!, ID.ROLE_NOVICE!].sort());
});

test('a role that fails once is tried again and set', async () => {
  const m = member([], { [ID.ROLE_CIV6!]: 1 });
  const sync = await syncRoles(m, ['grant_civ6_rank', 'grant_server_news'], undefined, 0);
  assert.deepEqual(sync, { applied: ['grant_server_news', 'grant_civ6_rank'], failed: [] });
  assert.equal(m.calls.filter((call) => call === `add ${ID.ROLE_CIV6}`).length, 2);
});

test('a role that fails twice is reported, and the rest are still set', async () => {
  const m = member([], { [ID.ROLE_CIV6!]: 2 });
  const sync = await syncRoles(m, ['grant_civ6_rank', 'grant_server_news'], undefined, 0);
  assert.deepEqual(sync, { applied: ['grant_server_news'], failed: ['grant_civ6_rank'] });
});
