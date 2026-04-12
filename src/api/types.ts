import type { SupportedGame } from '../config/types.js';

export type RegistrationPlatform = 'steam' | 'epic' | 'xbox';

export type RegistrationSessionStatus =
  | 'pending_auth'
  | 'validating'
  | 'validated'
  | 'failed'
  | 'expired'
  | 'completed';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  correlation_id?: string;
}

export interface ApiErrorEnvelope {
  error?: ApiErrorPayload;
  detail?: {
    error?: ApiErrorPayload;
  };
}

export interface RegistrationSessionResponse {
  session_id: string;
  authorize_url: string;
  expires_at: string;
}

export interface RegistrationSessionStatusResponse {
  session_id: string;
  status: RegistrationSessionStatus;
  expires_at?: string;
  failure_code?: string | null;
  failure_message?: string | null;
  game?: SupportedGame | null;
  platform?: RegistrationPlatform | null;
  linked_account_id?: string | null;
  linked_account_name?: string | null;
  discord_username?: string | null;
  discord_display_name?: string | null;
  discord_locale?: string | null;
  discord_verified?: boolean | null;
  discord_mfa_enabled?: boolean | null;
}

export type RoleIntent =
  | 'grant_civ6_rank'
  | 'grant_civ7_rank'
  | 'grant_novice'
  | 'remove_non_verified';

export interface RegistrationOperationResponse {
  operation_id: string;
  status?: string;
  discord_user_id: string;
  steam_id: string;
  steam_name?: string | null;
  linked_platform?: RegistrationPlatform | null;
  linked_account_id?: string | null;
  linked_account_name?: string | null;
  game: SupportedGame;
  role_intents: RoleIntent[];
}

export interface FinalizeOperationRequest {
  result: 'succeeded' | 'failed';
  applied_role_intents: RoleIntent[];
  failure_code: string | null;
  failure_message: string | null;
}

export interface LinkedAccountLookupHit {
  linked_platform?: RegistrationPlatform | null;
  linked_account_id: string;
  linked_account_name?: string | null;
}

export interface DiscordLookupResponse {
  discord_id: string;
  discord_username?: string | null;
  discord_display_name?: string | null;
  linked_accounts: LinkedAccountLookupHit[];
}

export interface DiscordAccountLookupHit {
  discord_id: string;
  discord_username?: string | null;
  discord_display_name?: string | null;
}

export interface LinkedAccountLookupResponse {
  linked_account_id: string;
  linked_account_name?: string | null;
  linked_platform?: RegistrationPlatform | null;
  discord_accounts: DiscordAccountLookupHit[];
}
