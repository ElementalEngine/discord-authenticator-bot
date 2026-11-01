import { config as loadEnv } from 'dotenv';
import path from 'node:path';

const env = process.env.NODE_ENV?.trim() || 'development';
if (!['development', 'test', 'production'].includes(env)) throw new Error(`Unsupported NODE_ENV: ${env}`);
loadEnv({ path: path.resolve(`.env.${env}`), override: false, quiet: true });

export const SNOWFLAKE = /^\d{17,20}$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// A Discord id is checked at startup, so a typo fails the start rather than a command.
function id(name: string): string {
  const value = required(name);
  if (!SNOWFLAKE.test(value)) throw new Error(`${name} is not a Discord id: ${value}`);
  return value;
}

function optionalId(name: string): string | undefined {
  return process.env[name]?.trim() ? id(name) : undefined;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export const config = {
  env,
  backend: {
    baseUrl: required('BACKEND_BASE_URL').replace(/\/+$/, ''),
    serviceToken: required('BACKEND_SERVICE_TOKEN'),
    timeoutMs: positiveInt('REQUEST_TIMEOUT_MS', 10_000),
  },
  discord: {
    token: required('BOT_TOKEN'),
    guildId: id('DISCORD_GUILD_ID'),
  },
  channels: {
    welcome: id('CHANNEL_WELCOME_ID'),
    civ6Commands: id('CHANNEL_COMMANDS_CIV6_ID'),
    civ7Commands: id('CHANNEL_COMMANDS_CIV7_ID'),
    botCommands: id('CHANNEL_BOT_COMMANDS_ID'),
    log: id('CHANNEL_AUTHBOT_LOG_ID'),
  },
  roles: {
    moderator: id('ROLE_MODERATOR'),
    developer: optionalId('ROLE_DEVELOPER'),
    civ6Rank: id('ROLE_CIV6'),
    civ7Rank: id('ROLE_CIV7'),
    novice: id('ROLE_NOVICE'),
    nonVerified: id('ROLE_NON_VERIFIED'),
    serverNews: id('ROLE_SERVER_NEWS'),
    civ6News: id('ROLE_CIV6_NEWS'),
    civ7News: id('ROLE_CIV7_NEWS'),
    pcSteam: id('ROLE_PC_STEAM'),
    twoKCrossplatform: optionalId('ROLE_2K_CROSSPLATFORM'),
  },
} as const;
