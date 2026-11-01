import type { RoleIntent } from '../api/types.js';
import { config } from './index.js';

export const IDS = {
  civ7Steam: 'auth:civ7:steam',
  civ7TwoK: 'auth:civ7:2k',
  cancel: 'auth:cancel',
  twoKModal: 'auth:2k',
  twoKAccountId: 'auth:2k:id',
  twoKAccountName: 'auth:2k:name',
} as const;

// The role each intent from core-api adds, or removes for remove_non_verified.
export const ROLE_OF: Readonly<Record<RoleIntent, string | undefined>> = {
  grant_civ6_rank: config.roles.civ6Rank,
  grant_civ7_rank: config.roles.civ7Rank,
  grant_novice: config.roles.novice,
  grant_server_news: config.roles.serverNews,
  grant_civ6_news: config.roles.civ6News,
  grant_civ7_news: config.roles.civ7News,
  grant_pc_steam: config.roles.pcSteam,
  grant_2k_crossplatform: config.roles.twoKCrossplatform,
  remove_non_verified: config.roles.nonVerified,
};

export const GAME_NAMES = { civ6: 'Civilization VI', civ7: 'Civilization VII' } as const;
