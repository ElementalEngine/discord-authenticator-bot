import assert from 'node:assert/strict';
import { test } from 'node:test';

// ApiClient's module imports the config layer, which fail-fasts on missing env —
// provide dummies before the dynamic import below.
for (const [k, v] of Object.entries({
  BACKEND_BASE_URL: 'http://backend.test',
  BACKEND_SERVICE_TOKEN: 'dummy-token',
  BOT_TOKEN: 'dummy',
  BOT_CLIENT_ID: '1',
  DISCORD_GUILD_ID: '1',
  CHANNEL_WELCOME_ID: '10',
  CHANNEL_COMMANDS_CIV6_ID: '11',
  CHANNEL_COMMANDS_CIV7_ID: '12',
  CHANNEL_BOT_COMMANDS_ID: '13',
  CHANNEL_AUTHBOT_LOG_ID: '14',
  CHANNEL_AUTHBOT_REG_ID: '15',
  ROLE_MODERATOR: '20',
  ROLE_CIV6: '21',
  ROLE_CIV7: '22',
  ROLE_NOVICE: '23',
  ROLE_NON_VERIFIED: '24',
})) {
  process.env[k] ??= v;
}
process.env.NODE_ENV ??= 'test';

const { ApiClient } = await import('../src/api/client.js');
const { ApiError } = await import('../src/api/errors.js');

type FetchLike = typeof fetch;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const clientWith = (fetcher: FetchLike): InstanceType<typeof ApiClient> =>
  new ApiClient({ baseUrl: 'http://backend.test', serviceToken: 'tok', timeoutMs: 200, fetcher });

test('parses a successful JSON response', async () => {
  const client = clientWith(async () => jsonResponse(200, { session_id: 's1', authorize_url: 'u', expires_at: 'e' }));
  const result = await client.createRegistrationSession({ discord_user_id: '1', game: 'civ6' });
  assert.equal(result.session_id, 's1');
});

test('sends bearer auth and JSON content type', async () => {
  let seen: Headers | undefined;
  const client = clientWith(async (_url, init) => {
    seen = new Headers(init?.headers);
    return jsonResponse(200, {});
  });
  await client.createRegistrationSession({ discord_user_id: '1', game: 'civ6' });
  assert.equal(seen?.get('authorization'), 'Bearer tok');
  assert.equal(seen?.get('content-type'), 'application/json');
});

test('maps the nested detail.error envelope to ApiError', async () => {
  const envelope = { detail: { error: { code: 'ACCOUNT_NOT_FOUND', message: 'nope', retryable: false } } };
  const client = clientWith(async () => jsonResponse(404, envelope));
  await assert.rejects(client.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'ACCOUNT_NOT_FOUND');
    assert.equal(error.status, 404);
    assert.equal(error.retryable, false);
    return true;
  });
});

test('maps the flat error envelope to ApiError (defensive dual parse)', async () => {
  const envelope = { error: { code: 'SOME_CODE', message: 'flat', retryable: true } };
  const client = clientWith(async () => jsonResponse(502, envelope));
  await assert.rejects(client.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'SOME_CODE');
    assert.equal(error.retryable, true);
    return true;
  });
});

test('non-envelope failures become HTTP_<status>, retryable iff 5xx', async () => {
  const client500 = clientWith(async () => new Response('oops', { status: 500 }));
  await assert.rejects(client500.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'HTTP_500');
    assert.equal(error.retryable, true);
    return true;
  });
  const client400 = clientWith(async () => new Response('bad', { status: 400 }));
  await assert.rejects(client400.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'HTTP_400');
    assert.equal(error.retryable, false);
    return true;
  });
});

test('network failure maps to BACKEND_UNAVAILABLE (retryable)', async () => {
  const client = clientWith(async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(client.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'BACKEND_UNAVAILABLE');
    assert.equal(error.retryable, true);
    return true;
  });
});

test('timeout aborts and maps to BACKEND_TIMEOUT (retryable)', async () => {
  const client = clientWith(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
  await assert.rejects(client.lookupByDiscordId('123'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'BACKEND_TIMEOUT');
    assert.equal(error.status, 504);
    assert.equal(error.retryable, true);
    return true;
  });
});
