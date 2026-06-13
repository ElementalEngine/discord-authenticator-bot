import type { SupportedGame } from './types.js';
import type { ManualRegistrationChoice } from '../api/types.js';

export const COMMAND_NAMES = {
  register: 'register',
  lookup: 'lookup',
  manualRegister: 'manual-register',
} as const;

export const REGISTER_SUBCOMMANDS = {
  civ6: 'civ6',
  civ7: 'civ7',
  addRankRole: 'add-rank-role',
} as const;

export const LOOKUP_TYPES = {
  discordId: 'discord-id',
  linkedAccountId: 'linked-account-id',
} as const;

export const ROLE_INTENTS = {
  grantCiv6Rank: 'grant_civ6_rank',
  grantCiv7Rank: 'grant_civ7_rank',
  grantNovice: 'grant_novice',
  removeNonVerified: 'remove_non_verified',
} as const;

export const GAME_CHOICES = [
  { name: 'Civilization VI', value: 'civ6' },
  { name: 'Civilization VII', value: 'civ7' },
] as const satisfies ReadonlyArray<{ name: string; value: SupportedGame }>;

export const MANUAL_REGISTER_PLATFORM_CHOICES = [
  { name: 'Steam', value: 'steam' },
  { name: 'Steam Family Share', value: 'steam_family_share' },
  { name: 'Epic', value: 'epic' },
  { name: '2K', value: '2k' },
] as const satisfies ReadonlyArray<{ name: string; value: ManualRegistrationChoice }>;

export const LOOKUP_TYPE_CHOICES = [
  { name: 'Discord ID', value: LOOKUP_TYPES.discordId },
  { name: 'Linked account ID', value: LOOKUP_TYPES.linkedAccountId },
] as const;

export const BUTTON_IDS = {
  registrationFinishPrefix: 'auth:finish:',
  registrationCancelPrefix: 'auth:cancel:',
  civ7MethodSteam: 'auth:civ7:steam',
  civ7MethodManual: 'auth:civ7:manual',
} as const;

export const MODAL_IDS = {
  civ7SelfServiceManual: 'auth:civ7:2kmodal',
} as const;

export const MODAL_FIELD_IDS = {
  twoKAccountId: 'auth:2k:id',
  twoKAccountName: 'auth:2k:name',
} as const;

export const EMOJIS = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  detail: '🔹',
} as const;
