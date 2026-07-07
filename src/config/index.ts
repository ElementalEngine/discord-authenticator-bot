import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import process from 'node:process';
import type { AuthBotConfig, NodeEnv } from './types.js';

function parseNodeEnv(raw: string | undefined): NodeEnv {
  switch (raw) {
    case 'development':
    case 'test':
    case 'production':
      return raw;
    case undefined:
    case '':
      return 'development';
    default:
      throw new Error(`Unsupported NODE_ENV: ${raw}`);
  }
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const envPath = path.resolve(`.env.${nodeEnv}`);

loadEnv({ path: envPath, override: false });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }
  return value;
}

export const config: AuthBotConfig = {
  env: nodeEnv,
  requestTimeoutMs: positiveInt('REQUEST_TIMEOUT_MS', 10_000),
  backend: {
    baseUrl: required('BACKEND_BASE_URL').replace(/\/+$/, ''),
    serviceToken: required('BACKEND_SERVICE_TOKEN'),
  },
  discord: {
    token: required('BOT_TOKEN'),
    clientId: required('BOT_CLIENT_ID'),
    guildId: required('DISCORD_GUILD_ID'),
    channels: {
      welcome: required('CHANNEL_WELCOME_ID'),
      civ6Commands: required('CHANNEL_COMMANDS_CIV6_ID'),
      civ7Commands: required('CHANNEL_COMMANDS_CIV7_ID'),
      botCommands: required('CHANNEL_BOT_COMMANDS_ID'),
      authLog: required('CHANNEL_AUTHBOT_LOG_ID'),
      registrationLog: required('CHANNEL_AUTHBOT_REG_ID'),
    },
    roles: {
      moderator: required('ROLE_MODERATOR'),
      developer: optional('ROLE_DEVELOPER'),
      civ6Rank: required('ROLE_CIV6'),
      civ7Rank: required('ROLE_CIV7'),
      novice: required('ROLE_NOVICE'),
      nonVerified: required('ROLE_NON_VERIFIED'),
      serverNews: required('ROLE_SERVER_NEWS'),
      civ6News: required('ROLE_CIV6_NEWS'),
      civ7News: required('ROLE_CIV7_NEWS'),
      pcSteam: required('ROLE_PC_STEAM'),
      twoKCrossplatform: optional('ROLE_2K_CROSSPLATFORM'),
      epic: optional('ROLE_EPIC'),
    },
  },
};
