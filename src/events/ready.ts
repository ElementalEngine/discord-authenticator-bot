import { Events, type Client } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
  console.log(`✅ Auth bot ready as ${client.user.tag}`);
}
