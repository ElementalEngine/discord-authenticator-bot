import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isManualRegistrationChoice, isSupportedGame } from '../src/utils/option-guards.js';

test('isSupportedGame accepts exactly the supported games', () => {
  assert.equal(isSupportedGame('civ6'), true);
  assert.equal(isSupportedGame('civ7'), true);
});

test('isSupportedGame rejects out-of-set values', () => {
  for (const value of ['civ8', 'CIV6', '4000', '', ' civ6', 'civ6 ']) {
    assert.equal(isSupportedGame(value), false, `should reject ${JSON.stringify(value)}`);
  }
});

test('isManualRegistrationChoice accepts all three platforms', () => {
  for (const value of ['steam', 'steam_family_share', '2k']) {
    assert.equal(isManualRegistrationChoice(value), true, `should accept ${value}`);
  }
});

test('isManualRegistrationChoice rejects out-of-set values', () => {
  for (const value of ['epic', 'xbox', 'Steam', '2K', '', 'steam ']) {
    assert.equal(isManualRegistrationChoice(value), false, `should reject ${JSON.stringify(value)}`);
  }
});
