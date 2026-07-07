import { REST, Routes } from 'discord.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from './config/index.js';
import { walkModuleFiles } from './utils/module-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function loadCommandsJson(): Promise<unknown[]> {
  const commandsPath = path.join(__dirname, 'commands');
  if (!existsSync(commandsPath)) throw new Error(`Commands directory not found: ${commandsPath}`);

  const commandData: unknown[] = [];
  for (const filePath of await walkModuleFiles(commandsPath)) {
    const mod = (await import(pathToFileURL(filePath).href)) as { data?: { toJSON?: () => unknown; name?: string } };
    if (typeof mod.data?.toJSON !== 'function' || typeof mod.data?.name !== 'string') continue;
    commandData.push(mod.data.toJSON());
  }
  return commandData;
}

async function main(): Promise<void> {
  const commands = await loadCommandsJson();
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  await rest.put(
    Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
    { body: commands },
  );

  console.log(`✅ Deployed ${commands.length} application commands.`);
}

void main().catch((error) => {
  console.error('Failed to deploy commands:', error);
  process.exit(1);
});
