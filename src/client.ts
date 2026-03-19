import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Command } from './types/global.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection<string, Command>();

const runtimeExtension = path.extname(__filename) === '.ts' ? '.ts' : '.js';

function isLoadable(file: string): boolean {
  return file.endsWith(runtimeExtension) && !file.endsWith('.d.ts') && !file.endsWith('.map');
}

async function walkFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(fullPath)));
      continue;
    }
    if (isLoadable(entry.name)) results.push(fullPath);
  }
  return results;
}

let initPromise: Promise<void> | null = null;

async function loadCommands(): Promise<number> {
  const commandsPath = path.join(__dirname, 'commands');
  if (!existsSync(commandsPath)) {
    throw new Error(`Commands directory not found: ${commandsPath}`);
  }

  let loaded = 0;
  for (const filePath of await walkFiles(commandsPath)) {
    const mod = (await import(pathToFileURL(filePath).href)) as Partial<Command> & {
      data?: { name?: unknown };
    };

    if (typeof mod.execute !== 'function' || typeof mod.data?.name !== 'string') {
      continue;
    }

    client.commands.set(mod.data.name, {
      data: mod.data as Command['data'],
      execute: mod.execute as Command['execute'],
    });
    loaded += 1;
  }

  return loaded;
}

async function loadEvents(): Promise<number> {
  const eventsPath = path.join(__dirname, 'events');
  if (!existsSync(eventsPath)) {
    throw new Error(`Events directory not found: ${eventsPath}`);
  }

  let loaded = 0;
  for (const filePath of await walkFiles(eventsPath)) {
    const mod = (await import(pathToFileURL(filePath).href)) as {
      name?: string;
      once?: boolean;
      execute?: (...args: unknown[]) => Promise<void> | void;
    };

    if (typeof mod.name !== 'string' || typeof mod.execute !== 'function') {
      continue;
    }

    if (mod.once) {
      client.once(mod.name as never, mod.execute as never);
    } else {
      client.on(mod.name as never, mod.execute as never);
    }
    loaded += 1;
  }

  return loaded;
}

export async function initClient(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const [commands, events] = await Promise.all([loadCommands(), loadEvents()]);
      console.log(`✅ Loaded ${commands} commands and ${events} events.`);
    })();
  }
  return initPromise;
}

export default client;
