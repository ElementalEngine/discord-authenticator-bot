import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ID } from './env.js';

const { refusalFor } = await import('../src/config/access.js');

const holding = (...roles: string[]) => new Set(roles);

test('staff commands need a staff role, and a moderator in the wrong channel is still refused', () => {
  const bot = ID.CHANNEL_BOT_COMMANDS_ID!;
  assert.equal(refusalFor('lookup', bot, holding()), 'Only staff can use this command.');
  assert.equal(refusalFor('lookup', bot, holding(ID.ROLE_MODERATOR!)), null);
  assert.equal(refusalFor('manual-register', bot, holding(ID.ROLE_DEVELOPER!)), null);
  assert.match(refusalFor('lookup', ID.CHANNEL_WELCOME_ID!, holding(ID.ROLE_MODERATOR!)) ?? '', /^Use this command in/);
});

test('registration starts only in welcome, and only for a member not yet verified', () => {
  const welcome = ID.CHANNEL_WELCOME_ID!;
  assert.equal(refusalFor('register civ6', welcome, holding(ID.ROLE_NON_VERIFIED!)), null);
  assert.match(refusalFor('register civ7', welcome, holding(ID.ROLE_MODERATOR!)) ?? '', /already registered/);
  assert.match(refusalFor('register add-rank-role', welcome, holding()) ?? '', /^Use this command in/);
  assert.equal(refusalFor('register add-rank-role', ID.CHANNEL_COMMANDS_CIV7_ID!, holding()), null);
});
