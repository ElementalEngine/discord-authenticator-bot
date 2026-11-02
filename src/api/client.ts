import { config } from '../config/index.js';
import { ApiError } from './errors.js';
import type {
  AccountLookup,
  Game,
  ManualRegistration,
  Registration,
  SessionStarted,
  SessionState,
  TwoKRegistration,
} from './types.js';

type FetchLike = typeof fetch;

// The retry policy lives here and nowhere else: no call site chooses.
const ATTEMPTS = 2;
const BACKOFF_MS = 250;

const path = (...parts: string[]): string => `/api/v2/auth/${parts.map(encodeURIComponent).join('/')}`;

export class ApiClient {
  constructor(
    private readonly base = config.backend.baseUrl,
    private readonly token = config.backend.serviceToken,
    private readonly fetcher: FetchLike = fetch,
    private readonly timeoutMs = config.backend.timeoutMs,
  ) {}

  startSession(discordUserId: string, game: Game): Promise<SessionStarted> {
    return this.call('POST', path('sessions'), { discord_user_id: discordUserId, game });
  }

  session(sessionId: string): Promise<SessionState> {
    return this.call('GET', path('sessions', sessionId));
  }

  // A repeat answers the same registration, so a lost answer can be asked for again.
  complete(sessionId: string, discordUserId: string): Promise<Registration> {
    return this.call('POST', path('sessions', sessionId, 'complete'), { discord_user_id: discordUserId });
  }

  rankRole(discordUserId: string, game: Game): Promise<Registration> {
    return this.call('POST', path('rank-roles'), { discord_user_id: discordUserId, game });
  }

  registerTwoK(body: TwoKRegistration): Promise<Registration> {
    return this.call('POST', path('2k-registrations'), body);
  }

  // Sent only after the bot has checked the caller's staff role.
  registerManually(staffId: string, body: ManualRegistration): Promise<Registration> {
    return this.call('POST', path('manual-registrations'), body, { 'x-actor-discord-id': staffId, 'x-actor-is-staff': 'true' });
  }

  lookupDiscord(discordId: string): Promise<AccountLookup> {
    return this.call('GET', path('accounts', 'discord', discordId));
  }

  lookupLinked(accountId: string): Promise<AccountLookup> {
    return this.call('GET', path('accounts', 'linked', accountId));
  }

  // core-api's retryable flag decides a second attempt on any method. A transport
  // failure may hide a write that landed, so then only a read is sent again.
  private static shouldRetry(error: unknown, method: string): boolean {
    if (error instanceof ApiError && error.error) return error.error.retryable === true;
    if (error instanceof ApiError && error.status < 500) return false;
    return method === 'GET';
  }

  private async call<T>(method: 'GET' | 'POST', route: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const headers = { accept: 'application/json', authorization: `Bearer ${this.token}`, ...extra, ...(body === undefined ? {} : { 'content-type': 'application/json' }) };
    for (let attempt = 1; ; attempt++) {
      try {
        // The signal covers reading the body too.
        const res = await this.fetcher(`${this.base}${route}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const parsed = parseJson(await res.text());
        if (!res.ok || parsed === undefined || parsed === null) throw new ApiError(res.status, parsed);
        return parsed as T;
      } catch (error) {
        if (attempt >= ATTEMPTS || !ApiClient.shouldRetry(error, method)) throw error;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (1 + Math.random())));
      }
    }
  }
}

// A body that is not JSON, such as a proxy's error page, is undefined; no body is null.
// Either is an error on a success, since every route answers with JSON.
function parseJson(text: string): unknown {
  try {
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return undefined;
  }
}

export const api = new ApiClient();
