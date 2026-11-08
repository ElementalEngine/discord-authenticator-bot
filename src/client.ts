import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type Interaction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

import * as lookup from './commands/lookup.js';
import * as manualRegister from './commands/manual-register.js';
import * as register from './commands/register.js';
import { config } from './config/index.js';
import { failed } from './flows/outcome.js';
import { notice } from './ui/kit.js';
import { show } from './ui/reply.js';
import { log } from './utils/log.js';

type Command = Readonly<{
  data: Readonly<{ name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody }>;
  run(interaction: ChatInputCommandInteraction<'cached'>): Promise<void>;
}>;

const COMMANDS: ReadonlyMap<string, Command> = new Map([register, lookup, manualRegister].map((command) => [command.data.name, command]));

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const open = new Set<Promise<void>>();
let stopping = false;

// Takes no new interaction and waits for those in hand, so a registration is not cut off midway.
export async function drained(): Promise<void> {
  stopping = true;
  while (open.size) await Promise.allSettled([...open]);
}

// Every interaction ends in an answer: a refusal or failure is shown to the
// person who acted, and staff hear of anything that is our fault.
async function route(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) return;
  if (stopping) return show(interaction, notice('refused', 'The bot is restarting. Try again in a minute.'));
  if (!interaction.inCachedGuild()) return show(interaction, notice('refused', 'Use this in the CPL server.'));
  try {
    if (interaction.isChatInputCommand()) {
      const command = COMMANDS.get(interaction.commandName);
      if (!command) return show(interaction, notice('refused', 'That command is gone.'));
      await command.run(interaction);
    } else if (interaction.isButton()) {
      await register.press(interaction);
    } else if (interaction.isModalSubmit()) {
      await register.submit(interaction);
    }
  } catch (error) {
    await show(interaction, await failed(interaction.guild, interaction.user.id, error, 'finish that'));
  }
}

// The commands are set on Discord at every start, so the code is their source.
async function ready(bot: Client<true>): Promise<void> {
  await bot.application.commands.set([...COMMANDS.values()].map((command) => command.data.toJSON()), config.discord.guildId);
  log.info(`Loaded ${COMMANDS.size} commands`);
  log.info(`Auth bot ready as ${bot.user.tag}`);
}

client.once(Events.ClientReady, (bot) => {
  ready(bot).catch((error: unknown) => log.error('commands not set on Discord', error));
});
client.on(Events.InteractionCreate, (interaction) => {
  const running = route(interaction);
  open.add(running);
  const done = (): void => void open.delete(running);
  running.then(done, done);
});
