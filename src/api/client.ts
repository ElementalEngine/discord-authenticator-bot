import { config } from '../config/index.js';
import type { SupportedGame } from '../config/types.js';
import { ApiError } from './errors.js';
import type {
  ApiErrorEnvelope,
  DiscordLookupResponse,
  FinalizeOperationRequest,
  LinkedAccountLookupResponse,
  RegistrationOperationResponse,
  RegistrationPlatform,
  RegistrationSessionResponse,
  RegistrationSessionStatusResponse,
} from './types.js';

type FetchLike = typeof fetch;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;
  private readonly fetcher: FetchLike;

  constructor(options?: {
    baseUrl?: string;
    serviceToken?: string;
    timeoutMs?: number;
    fetcher?: FetchLike;
  }) {
    this.baseUrl = (options?.baseUrl ?? config.backend.baseUrl).replace(/\/+$/, '');
    this.serviceToken = options?.serviceToken ?? config.backend.serviceToken;
    this.timeoutMs = options?.timeoutMs ?? config.requestTimeoutMs;
    this.fetcher = options?.fetcher ?? fetch;
  }

  async createRegistrationSession(input: {
    discord_user_id: string;
    game: SupportedGame;
  }): Promise<RegistrationSessionResponse> {
    return this.requestJson<RegistrationSessionResponse>('/api/v1/auth/registration-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getRegistrationSession(sessionId: string): Promise<RegistrationSessionStatusResponse> {
    return this.requestJson<RegistrationSessionStatusResponse>(
      `/api/v1/auth/registration-sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' },
    );
  }

  async completeRegistrationSession(input: {
    sessionId: string;
    discord_user_id: string;
  }): Promise<RegistrationOperationResponse> {
    return this.requestJson<RegistrationOperationResponse>(
      `/api/v1/auth/registration-sessions/${encodeURIComponent(input.sessionId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ discord_user_id: input.discord_user_id }),
      },
    );
  }

  async finalizeRegistrationOperation(
    operationId: string,
    input: FinalizeOperationRequest,
  ): Promise<void> {
    await this.requestJson<unknown>(
      `/api/v1/auth/registration-operations/${encodeURIComponent(operationId)}/finalize`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async requestRankRole(input: {
    discord_user_id: string;
    game: SupportedGame;
  }): Promise<RegistrationOperationResponse> {
    return this.requestJson<RegistrationOperationResponse>('/api/v1/auth/rank-role-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async manualRegister(input: {
    actor_discord_id: string;
    subject_discord_id: string;
    platform: RegistrationPlatform;
    platform_account_id: string;
    platform_account_name: string;
    game: SupportedGame;
    reason?: string;
    discord_username?: string | null;
    discord_display_name?: string | null;
  }): Promise<RegistrationOperationResponse> {
    return this.requestJson<RegistrationOperationResponse>(
      '/api/v1/auth/admin/manual-registrations',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async lookupByDiscordId(discordId: string): Promise<DiscordLookupResponse> {
    return this.requestJson<DiscordLookupResponse>(
      `/api/v1/auth/admin/accounts/discord/${encodeURIComponent(discordId)}`,
      { method: 'GET' },
    );
  }

  async lookupByLinkedAccountId(linkedAccountId: string): Promise<LinkedAccountLookupResponse> {
    return this.requestJson<LinkedAccountLookupResponse>(
      `/api/v1/auth/admin/accounts/linked-account/${encodeURIComponent(linkedAccountId)}`,
      { method: 'GET' },
    );
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.serviceToken}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = text ? tryParseJson(text) : null;

      if (!response.ok) {
        throw toApiError(response.status, parsed);
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({
          message: 'The auth backend did not respond in time.',
          code: 'BACKEND_TIMEOUT',
          status: 504,
          retryable: true,
        });
      }

      throw new ApiError({
        message: 'Failed to reach the auth backend.',
        code: 'BACKEND_UNAVAILABLE',
        status: 503,
        retryable: true,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toApiError(status: number, parsed: unknown): ApiError {
  const envelope = parsed as ApiErrorEnvelope | null;
  const error = envelope?.error ?? envelope?.detail?.error;

  if (error?.code && error?.message) {
    return new ApiError({
      message: error.message,
      code: error.code,
      status,
      retryable: error.retryable ?? false,
      correlationId: error.correlation_id,
      details: error.details,
    });
  }

  return new ApiError({
    message: typeof parsed === 'string' && parsed ? parsed : 'Unexpected backend error.',
    code: `HTTP_${status}`,
    status,
    retryable: status >= 500,
    details: parsed,
  });
}
