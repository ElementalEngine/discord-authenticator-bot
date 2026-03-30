import type { SupportedGame } from './types.js';

export const COMMAND_NAMES = {
  register: 'register',
  admin: 'admin',
} as const;

export const ADMIN_SUBCOMMANDS = {
  manualRegister: 'manual-register',
  lookupDiscord: 'lookup-discord',
  lookupSteam: 'lookup-steam',
} as const;

export const REGISTER_SUBCOMMANDS = {
  register: 'register',
  addRankRole: 'add-rank-role',
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

export const REGISTRATION_PLATFORM_CHOICES = [
  { name: 'Steam', value: 'steam' },
  { name: 'Epic', value: 'epic' },
  { name: 'Xbox', value: 'xbox' },
] as const;

export const BUTTON_IDS = {
  registrationFinishPrefix: 'auth:finish:',
  registrationCancelPrefix: 'auth:cancel:',
} as const;

export const EMOJIS = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
} as const;
