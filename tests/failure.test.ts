import assert from 'node:assert/strict';
import { test } from 'node:test';

import './env.js';

const { ApiError } = await import('../src/api/errors.js');
const { Refusal, failureOf, waitOut } = await import('../src/ui/failure.js');

const answer = (status: number, code: string, message: string, retryable = false, correlation_id: string | null = 'ref9') =>
  new ApiError(status, { detail: { error: { code, message, retryable, correlation_id } } });

test("a rejected service token never reaches the player, and staff are told", () => {
  const failure = failureOf(answer(401, 'UNAUTHORIZED', 'Missing or invalid service authorization.', false, null));
  assert.equal(failure.staff, true);
  assert.doesNotMatch(failure.text, /authorization|token/i);
});

test('the rank-role refusal tells the player why, in core-api words', () => {
  const message = 'A second rank role needs a Steam registration verified by the bot. Please ask staff to add it.';
  const failure = failureOf(answer(400, 'RANK_ROLE_NEEDS_STEAM', message));
  assert.deepEqual(failure, { tone: 'refused', text: `${message} (ref ref9)`, staff: false });
});

test('a bug in core-api is ours: a generic answer with its ref, and staff told', () => {
  const failure = failureOf(answer(500, 'INTERNAL', 'Something went wrong.'));
  assert.equal(failure.tone, 'failed');
  assert.equal(failure.staff, true);
  assert.match(failure.text, /ref ref9/);
});

test("an outage core-api calls retryable shows its own words once, without staff", () => {
  const message = 'Steam account validation is temporarily unavailable. Please try again.';
  const failure = failureOf(answer(502, 'STEAM_API_FAILURE', message, true));
  assert.deepEqual(failure, { tone: 'failed', text: `${message} (ref ref9)`, staff: false });
});

test("a clash tells the player only core-api's words, never the other account", () => {
  const clash = new ApiError(409, {
    detail: {
      error: {
        code: 'STEAM_ID_CONFLICT',
        message: 'This Steam account is already linked to another Discord account. Please contact staff if you believe this is a mistake.',
        retryable: false,
        correlation_id: 'ref9',
        details: { steam_id: '76561198000000001', existing_discord_id: '300000000000000002', standing: { suspended: true, at_ban_threshold: false, tiers: { cheating: 2 } } },
      },
    },
  });
  const failure = failureOf(clash);
  assert.equal(failure.tone, 'refused');
  assert.doesNotMatch(failure.text, /300000000000000002|76561198000000001|suspended|cheating/);
});

test('validation failures and misconfiguration are ours, not the player\'s', () => {
  for (const error of [answer(422, 'INVALID_REQUEST', 'The request failed validation.'), answer(503, 'AUTH_MISCONFIGURED', 'Discord OAuth is not configured.')]) {
    const failure = failureOf(error);
    assert.equal(failure.staff, true);
    assert.doesNotMatch(failure.text, /validation|configured/);
  }
});

test('no answer, a refusal of ours and an unknown error each say the right thing', () => {
  assert.equal(failureOf(new DOMException('timed out', 'TimeoutError')).staff, false);
  assert.deepEqual(failureOf(new Refusal('Use this command in #welcome.')), { tone: 'refused', text: 'Use this command in #welcome.', staff: false });
  const unknown = failureOf(new Error('boom'));
  assert.equal(unknown.staff, true);
  assert.doesNotMatch(unknown.text, /boom/);
});

test('a sign-in waits out an outage or silence, and ends on any other answer', () => {
  assert.equal(waitOut(answer(502, 'STEAM_API_FAILURE', 'x', true)), true);
  assert.equal(waitOut(new TypeError('fetch failed')), true);
  assert.equal(waitOut(new ApiError(502, '<html>')), true);
  assert.equal(waitOut(answer(409, 'STEAM_ID_CONFLICT', 'x')), false);
  assert.equal(waitOut(answer(500, 'INTERNAL', 'x')), false);
  assert.equal(waitOut(new TypeError('settle is not a function')), false);
});

test("a proxy's 4xx is our fault, not an outage to wait out", () => {
  assert.equal(waitOut(new ApiError(404, '<html>')), false);
});
