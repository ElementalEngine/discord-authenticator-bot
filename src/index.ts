import { setTimeout as wait } from 'node:timers/promises';

import { client, drained } from './client.js';
import { config } from './config/index.js';
import { watch } from './flows/steam.js';
import { log } from './utils/log.js';

// A registration in hand can wait out two core-api attempts, then set roles and log.
const DRAIN_MS = 2 * config.backend.timeoutMs + 10_000;

// A shutdown ends every sign-in watch and lets the interactions in hand finish,
// so nothing runs after the client goes.
async function shutdown(signal: string): Promise<void> {
  log.info(`${signal}: shutting down`);
  try {
    await Promise.race([Promise.all([watch.stopAll(), drained()]), wait(DRAIN_MS, undefined, { ref: false })]);
    await client.destroy();
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason));

log.info(`Starting auth bot (${config.env})`);
client.login(config.discord.token).catch((error: unknown) => {
  log.error('auth bot failed to start', error);
  process.exit(1);
});
