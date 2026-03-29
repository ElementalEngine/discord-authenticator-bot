import type { SupportedGame } from '../config/types.js';

export type RegistrationSessionStatus =
  | 'pending_auth'
  | 'validating'
  | 'validated'
  | 'failed'
  | 'expired'
  | 'completed';

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    correlation_id?: string;
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
  game?: SupportedGame;
  platform?: string;
  expires_at?: string | null;
  linked_account_id?: string | null;
  linked_account_name?: string | null;
  oauth_username_snapshot?: string | null;
  oauth_display_name_snapshot?: string | null;
  oauth_locale?: string | null;
  oauth_verified?: boolean | null;
  oauth_mfa_enabled?: boolean | null;
  oauth_premium_type?: number | null;
  failure_code?: string | null;
  failure_message?: string | null;
  details?: Record<string, unknown>;
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
  game: SupportedGame;
  role_intents: RoleIntent[];
}

export interface FinalizeOperationRequest {
  result: 'succeeded' | 'failed';
  applied_role_intents: RoleIntent[];
  failure_code: string | null;
  failure_message: string | null;
}

export interface AccountRegistrationRecord {
  status: string;
  method: string;
  registered_at: string;
  ownership_verified_at?: string | null;
  playtime_minutes?: number | null;
}

export interface AccountLookupResponse {
  discord_id: string;
  steam_id: string | null;
  username_snapshot: string | null;
  display_name_snapshot: string | null;
  registrations: Partial<Record<SupportedGame, AccountRegistrationRecord>>;
  created_at?: string;
  updated_at?: string;
}
