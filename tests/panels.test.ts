import assert from 'node:assert/strict';
import { test } from 'node:test';

import './env.js';

const panels = await import('../src/ui/panels.js');

const registration = {
  discord_user_id: '300000000000000001',
  game: 'civ6' as const,
  linked_platform: 'steam' as const,
  linked_account_id: '76561198000000001',
  linked_account_name: 'Pat',
  registration_method: 'oauth_steam_api' as const,
  role_intents: [],
  flags: [],
};

test('the player reads about their own roles; staff read about the player they registered', () => {
  const nothingNew = { applied: [], failed: [] };
  const failed = { applied: [], failed: ['grant_civ6_rank' as const] };
  assert.ok(panels.registered(registration, nothingNew).lines.includes('Your roles were already set.'));
  assert.ok(panels.registeredBy(registration, nothingNew).lines.includes('Their roles were already set.'));
  assert.ok(panels.registered(registration, failed).lines.some((line) => line.includes('Staff have been told')));
  assert.ok(panels.registeredBy(registration, failed).lines.some((line) => line.includes('staff log says which')));
  assert.equal(panels.registeredBy(registration, failed).tone, 'refused');
});
