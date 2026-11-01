import assert from 'node:assert/strict';
import { test } from 'node:test';

import './env.js';

const { ApiClient } = await import('../src/api/client.js');
const { ApiError } = await import('../src/api/errors.js');

type Call = { url: string; method: string; headers: Headers };

const envelope = (code: string, retryable: boolean, nested = true): unknown => {
  const error = { code, message: `${code} message`, retryable, correlation_id: 'abc123' };
  return nested ? { detail: { error } } : { error };
};

// A fetch that answers from a script and records each call.
function scripted(...answers: (Response | Error)[]): { fetcher: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers) });
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]!;
    if (answer instanceof Error) throw answer;
    return answer.clone();
  }) as typeof fetch;
  return { fetcher, calls };
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status });
const client = (fetcher: typeof fetch, timeoutMs = 1000) => new ApiClient('http://core.test', 'token', fetcher, timeoutMs);

test('a write core-api calls retryable is sent once more and then succeeds', async () => {
  const { fetcher, calls } = scripted(json(502, envelope('STEAM_API_FAILURE', true)), json(200, { ok: 1 }));
  assert.deepEqual(await client(fetcher).complete('s1', '123456789012345678'), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('an answer core-api calls not retryable is never sent again, on any method', async () => {
  for (const call of [(c: InstanceType<typeof ApiClient>) => c.session('s1'), (c: InstanceType<typeof ApiClient>) => c.rankRole('123456789012345678', 'civ6')]) {
    const { fetcher, calls } = scripted(json(500, envelope('INTERNAL', false)));
    await assert.rejects(call(client(fetcher)), ApiError);
    assert.equal(calls.length, 1);
  }
});

test('no answer at all is asked again on a read only, since a write may have landed', async () => {
  const read = scripted(new TypeError('fetch failed'), json(200, { status: 'pending_auth' }));
  await client(read.fetcher).session('s1');
  assert.equal(read.calls.length, 2);
  const write = scripted(new TypeError('fetch failed'));
  await assert.rejects(client(write.fetcher).startSession('123456789012345678', 'civ6'), TypeError);
  assert.equal(write.calls.length, 1);
});

test('a refusal is never retried, and both envelope shapes are read', async () => {
  for (const nested of [true, false]) {
    const { fetcher, calls } = scripted(json(409, envelope('STEAM_ID_CONFLICT', false, nested)));
    await assert.rejects(client(fetcher).lookupDiscord('123456789012345678'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'STEAM_ID_CONFLICT');
      assert.equal(error.error?.correlation_id, 'abc123');
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test("a proxy's error page becomes an ApiError with no envelope", async () => {
  const { fetcher } = scripted(new Response('<html>Bad Gateway</html>', { status: 502 }));
  await assert.rejects(client(fetcher).complete('s1', '123456789012345678'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.error, null);
    return true;
  });
});

test('a call that outlives its timeout is aborted', async () => {
  const hang = ((_input: string | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))) as typeof fetch;
  // The timeout's timer does not hold the process open, so the test does.
  const alive = setInterval(() => undefined, 1000);
  try {
    await assert.rejects(client(hang, 20).startSession('123456789012345678', 'civ6'), { name: 'TimeoutError' });
  } finally {
    clearInterval(alive);
  }
});

test('only a manual registration asserts staff, and every call carries the service token', async () => {
  const { fetcher, calls } = scripted(json(200, {}));
  const api = client(fetcher);
  await api.registerManually('111111111111111111', {
    subject_discord_id: '222222222222222222',
    game: 'civ6',
    platform: 'steam',
    platform_account_id: '76561198000000000',
  });
  await api.registerTwoK({ discord_user_id: '222222222222222222', platform_account_id: 'abc' });
  assert.equal(calls[0]!.url, 'http://core.test/api/v2/auth/manual-registrations');
  assert.equal(calls[0]!.headers.get('x-actor-discord-id'), '111111111111111111');
  assert.equal(calls[0]!.headers.get('x-actor-is-staff'), 'true');
  assert.equal(calls[1]!.headers.get('x-actor-is-staff'), null);
  for (const call of calls) assert.equal(call.headers.get('authorization'), 'Bearer token');
});

test('ids are sent as path segments, never as path', async () => {
  const { fetcher, calls } = scripted(json(200, {}));
  await client(fetcher).lookupLinked('../sessions/x');
  assert.equal(calls[0]!.url, 'http://core.test/api/v2/auth/accounts/linked/..%2Fsessions%2Fx');
});

test('every call the bot makes is a route and method in the vendored core-api spec', async () => {
  const { readFileSync } = await import('node:fs');
  const spec = JSON.parse(readFileSync(new URL('../contracts/openapi.json', import.meta.url), 'utf8')) as { paths: Record<string, Record<string, unknown>> };
  const routes = Object.entries(spec.paths).map(([template, methods]) => ({
    pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
    methods: Object.keys(methods),
  }));
  const { fetcher, calls } = scripted(json(200, {}));
  const api = client(fetcher);
  const id = '123456789012345678';
  await api.startSession(id, 'civ6');
  await api.session('s1');
  await api.complete('s1', id);
  await api.rankRole(id, 'civ7');
  await api.registerTwoK({ discord_user_id: id, platform_account_id: 'a' });
  await api.registerManually(id, { subject_discord_id: id, game: 'civ6', platform: '2k', platform_account_id: 'a' });
  await api.lookupDiscord(id);
  await api.lookupLinked('a');
  assert.equal(calls.length, 8);
  for (const call of calls) {
    const path = new URL(call.url).pathname;
    assert.ok(path.startsWith('/api/v2/auth/'), path);
    const route = routes.find((r) => r.pattern.test(path));
    assert.ok(route?.methods.includes(call.method.toLowerCase()), `${call.method} ${path} is not in the spec`);
  }
});
