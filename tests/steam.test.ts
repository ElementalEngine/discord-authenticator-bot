import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import './env.js';

const { api } = await import('../src/api/client.js');
const { ApiError } = await import('../src/api/errors.js');
const { watch } = await import('../src/flows/steam.js');

type Start = Parameters<typeof watch.start>;
type SessionState = Awaited<ReturnType<typeof api.session>>;

mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-01T12:00:00Z') });

// Lets the promise chains a timer started run to the next await on a fake.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
};
const poll = async (): Promise<void> => {
  mock.timers.tick(2500);
  await settle();
};

// Ids are past a double's exact range, so they count as BigInts.
let ids = 300000000000000100n;

// A player mid-registration: what they were shown, and what staff were told.
function player() {
  const id = String(ids++);
  const shown: string[] = [];
  const staff: string[] = [];
  const client = { channels: { fetch: async () => ({ isSendable: () => true, send: async (m: { content: string }) => void staff.push(m.content) }) } };
  const guild = { client, bans: { fetch: async () => Promise.reject(new Error('no ban access')) } };
  const editReply = async (options: { components: { toJSON(): unknown }[] }) => void shown.push(JSON.stringify(options.components.map((c) => c.toJSON())));
  const interaction = { createdTimestamp: Date.now(), deferred: true, replied: false, client, guild, editReply } as unknown as Start[0];
  const member = { id, displayName: 'Pat', roles: { cache: new Set<string>(), add: async () => undefined, remove: async () => undefined } } as unknown as Start[1];
  return { id, interaction, member, shown, staff, last: () => shown.at(-1) ?? '' };
}

const registration = (id: string) => ({
  discord_user_id: id,
  game: 'civ6' as const,
  linked_platform: 'steam' as const,
  linked_account_id: '76561198000000001',
  registration_method: 'oauth_steam_api' as const,
  role_intents: ['grant_civ6_rank' as const],
  flags: [],
});
const started = (session: string) => async () => ({ session_id: session, authorize_url: 'https://discord.test/authorize', expires_at: new Date(Date.now() + 300_000).toISOString() });
const state = (status: SessionState['status']) => async (): Promise<SessionState> => ({ session_id: 's', status, expires_at: new Date(Date.now() + 300_000).toISOString(), game: 'civ6' });
const timeout = () => new DOMException('timed out', 'TimeoutError');

// A complete that answers only when the test says so.
function heldComplete() {
  const calls = { n: 0 };
  let answer!: (value: unknown) => void;
  let fail!: (error: unknown) => void;
  api.complete = async () => {
    calls.n += 1;
    return new Promise((resolve, reject) => {
      answer = resolve as (value: unknown) => void;
      fail = reject;
    });
  };
  return { calls, answer: (value: unknown) => answer(value), fail: (error: unknown) => fail(error) };
}

test('a registration core-api makes is acted on even when the player cancels meanwhile', async () => {
  const p = player();
  api.startSession = started('s-cancel');
  api.session = state('validated');
  const complete = heldComplete();
  await watch.start(p.interaction, p.member, 'civ6');
  await poll();
  assert.equal(watch.cancel(p.id, 's-cancel'), false);
  complete.answer(registration(p.id));
  await settle();
  assert.match(p.last(), /Registered for Civilization VI/);
  assert.ok(p.staff.some((line) => line.startsWith('[REGISTERED]')));
});

test('an unanswered registration is asked for again, and a cancel cannot stop it', async () => {
  const p = player();
  api.startSession = started('s-again');
  api.session = state('validated');
  const complete = heldComplete();
  await watch.start(p.interaction, p.member, 'civ6');
  await poll();
  complete.fail(timeout());
  await settle();
  assert.equal(watch.cancel(p.id, 's-again'), false);
  api.session = state('completed');
  await poll();
  complete.answer(registration(p.id));
  await settle();
  assert.equal(complete.calls.n, 2);
  assert.match(p.last(), /Registered for Civilization VI/);
});

test('two starts at once leave one sign-in watched, and the older message is told', async () => {
  const p = player();
  const older = player();
  let n = 0;
  api.startSession = async () => started(`s-twin-${++n}`)();
  const polled: string[] = [];
  api.session = async (sessionId: string) => {
    polled.push(sessionId);
    return state('pending_auth')();
  };
  await watch.start(older.interaction, p.member, 'civ6');
  // The older message's edit is slow, so both new starts run while it is pending.
  const editOlder = (older.interaction as unknown as { editReply: (o: unknown) => Promise<void> }).editReply;
  (older.interaction as unknown as { editReply: (o: unknown) => Promise<void> }).editReply = async (o) => {
    await settle();
    await editOlder(o);
  };
  const second = player();
  await Promise.all([watch.start(second.interaction, p.member, 'civ6'), watch.start(p.interaction, p.member, 'civ6')]);
  await poll();
  assert.deepEqual(polled, ['s-twin-3']);
  assert.match(older.last(), /started another sign-in/);
  assert.match(second.last(), /started another sign-in/);
  watch.cancel(p.id, 's-twin-3');
});

test('a stale Cancel does not stop the current sign-in', async () => {
  const p = player();
  let n = 0;
  api.startSession = async () => started(`s-stale-${++n}`)();
  const polled: string[] = [];
  api.session = async (sessionId: string) => {
    polled.push(sessionId);
    return state('pending_auth')();
  };
  await watch.start(p.interaction, p.member, 'civ6');
  await watch.start(p.interaction, p.member, 'civ6');
  watch.cancel(p.id, 's-stale-1');
  await poll();
  assert.deepEqual(polled, ['s-stale-2']);
  assert.equal(watch.cancel(p.id, 's-stale-2'), true);
  await poll();
  assert.deepEqual(polled, ['s-stale-2']);
});

test('a clash on complete ends the sign-in, tells the player plainly and staff fully', async () => {
  const p = player();
  api.startSession = started('s-clash');
  api.session = state('validated');
  const other = '300000000000999999';
  api.complete = async () => {
    throw new ApiError(409, {
      detail: { error: { code: 'STEAM_ID_CONFLICT', message: 'This Steam account is already linked to another Discord account.', retryable: false, details: { steam_id: '76561198000000002', existing_discord_id: other, standing: null } } },
    });
  };
  await watch.start(p.interaction, p.member, 'civ6');
  await poll();
  assert.match(p.last(), /already linked to another Discord account/);
  assert.doesNotMatch(p.last(), new RegExp(other));
  assert.ok(p.staff.some((line) => line.startsWith('[CLASH]') && line.includes(other)));
});

test('a sign-in nobody finishes ends as expired', async () => {
  const p = player();
  api.startSession = started('s-expire');
  api.session = state('pending_auth');
  await watch.start(p.interaction, p.member, 'civ6');
  for (let i = 0; i < 121; i++) await poll();
  assert.match(p.last(), /sign-in expired/);
});

test('a registration whose answer never comes is handed to staff when its session expires', async () => {
  const p = player();
  api.startSession = started('s-lost');
  api.session = state('validated');
  const complete = heldComplete();
  await watch.start(p.interaction, p.member, 'civ6');
  await poll();
  complete.fail(timeout());
  await settle();
  api.session = state('expired');
  await poll();
  assert.ok(p.staff.some((line) => line.includes('confirm a Steam registration')));
  assert.match(p.last(), /couldn't confirm your registration/);
});

test('a bug after core-api was asked is not asked again forever: staff confirm it', async () => {
  const p = player();
  api.startSession = started('s-bug');
  api.session = state('validated');
  let calls = 0;
  api.complete = async () => {
    calls += 1;
    throw new TypeError('settle is not a function');
  };
  await watch.start(p.interaction, p.member, 'civ6');
  await poll();
  await poll();
  assert.equal(calls, 1);
  assert.ok(p.staff.some((line) => line.includes('confirm a Steam registration')));
  assert.match(p.last(), /Staff have been told/);
});

// Last: a shutdown leaves the shared watch stopping.
test('a shutdown hands every unanswered registration to staff, tells each player, and refuses new sign-ins', async () => {
  const waiting = player();
  const inFlight = player();
  const late = player();
  let n = 0;
  api.startSession = async () => started(`s-stop-${++n}`)();
  api.session = state('validated');
  let complete = heldComplete();
  await watch.start(waiting.interaction, waiting.member, 'civ6');
  await poll();
  complete.fail(timeout());
  await settle();
  // The first is now waiting out the outage; the second is mid-registration.
  api.session = async (sessionId: string) => (sessionId === 's-stop-1' ? state('pending_auth')() : state('validated')());
  complete = heldComplete();
  await watch.start(inFlight.interaction, inFlight.member, 'civ6');
  await poll();
  const stopping = watch.stopAll();
  await watch.start(late.interaction, late.member, 'civ6');
  complete.fail(timeout());
  await stopping;
  assert.ok(waiting.staff.some((line) => line.includes('confirm a Steam registration')));
  assert.match(waiting.last(), /couldn't confirm your registration/);
  assert.ok(inFlight.staff.some((line) => line.includes('confirm a Steam registration')));
  assert.match(inFlight.last(), /didn't answer/);
  assert.match(late.last(), /restarted/);
  let polls = 0;
  api.session = async () => {
    polls += 1;
    return state('completed')();
  };
  await poll();
  assert.equal(polls, 0);
});
