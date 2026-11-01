import { client } from './client.js';
import { config } from './config/index.js';
import { watch } from './flows/steam.js';
import { log } from './utils/log.js';

// A shutdown ends every sign-in watch, so nothing runs after the client goes.
async function shutdown(signal: string): Promise<void> {
  log.info(`${signal}: shutting down`);
  await watch.stopAll();
  await client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason));

log.info(`Starting auth bot (${config.env})`);
client.login(config.discord.token).catch((error: unknown) => {
  log.error('auth bot failed to start', error);
  process.exit(1);
});
