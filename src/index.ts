import client, { initClient } from './client.js';
import { config } from './config/index.js';

async function main(): Promise<void> {
  try {
    console.log(`⚙️ Starting auth bot in ${config.env} mode...`);
    await initClient();
    await client.login(config.discord.token);
  } catch (error) {
    console.error('Fatal error starting auth bot:', error);
    process.exit(1);
  }
}

void main();

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  try {
    console.log(`🛑 Received ${signal}. Shutting down...`);
    client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
