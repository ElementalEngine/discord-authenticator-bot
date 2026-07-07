import type { SupportedGame } from '../config/types.js';

export type RegistrationPlatform = 'steam' | 'epic' | '2k' | 'xbox';

export type RegistrationMethod =
  | 'oauth_steam_api'
  | 'admin_steam_family_share'
  | 'admin_staff_attested'
  | 'self_service_2k';

export type ManualRegistrationChoice = 'steam' | 'steam_family_share' | 'epic' | '2k';

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
  | 'grant_server_news'
  | 'grant_civ6_news'
  | 'grant_civ7_news'
  | 'grant_pc_steam'
  | 'grant_2k_crossplatform'
  | 'remove_non_verified'
  | 'remove_epic';

export interface RegistrationOperationResponse {
  operation_id: string;
  status?: string;
  discord_user_id: string;
  steam_id: string;
  steam_name?: string | null;
  linked_platform?: RegistrationPlatform | null;
  linked_account_id?: string | null;
  linked_account_name?: string | null;
  registration_method?: RegistrationMethod | null;
  game: SupportedGame;
  role_intents: RoleIntent[];
}

export interface FinalizeOperationRequest {
  result: 'succeeded' | 'failed';
  applied_role_intents: RoleIntent[];
  failure_code: string | null;
  failure_message: string | null;
}

export interface SelfServiceRegistrationRequest {
  discord_user_id: string;
  game: SupportedGame;
  platform: RegistrationPlatform;
  platform_account_id: string;
  platform_account_name?: string | null;
  discord_username?: string | null;
  discord_display_name?: string | null;
}

export interface RegistrationSummary {
  game: SupportedGame;
  // `string` (not RegistrationMethod) to tolerate legacy stored values like "oauth".
  method?: string | null;
  registered_at?: string | null;
}

export interface LinkedAccountLookupHit {
  linked_platform?: RegistrationPlatform | null;
  linked_account_id: string;
  linked_account_name?: string | null;
  registrations?: RegistrationSummary[];
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
  registrations?: RegistrationSummary[];
}

export interface LinkedAccountLookupResponse {
  linked_account_id: string;
  linked_account_name?: string | null;
  linked_platform?: RegistrationPlatform | null;
  discord_accounts: DiscordAccountLookupHit[];
}
