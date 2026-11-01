import { config } from './index.js';

// Where each command may run and who may run it, checked before any work.
export type Leaf = 'register civ6' | 'register civ7' | 'register add-rank-role' | 'lookup' | 'manual-register';

type Rule = Readonly<{ channels: readonly string[]; staff?: true; role?: string }>;

const { channels, roles } = config;

const ACCESS: Readonly<Record<Leaf, Rule>> = {
  'register civ6': { channels: [channels.welcome], role: roles.nonVerified },
  'register civ7': { channels: [channels.welcome], role: roles.nonVerified },
  'register add-rank-role': { channels: [channels.civ6Commands, channels.civ7Commands] },
  lookup: { channels: [channels.botCommands], staff: true },
  'manual-register': { channels: [channels.botCommands], staff: true },
};

type Roles = Readonly<{ has(id: string): boolean }>;

const isStaff = (held: Roles): boolean =>
  held.has(roles.moderator) || (roles.developer !== undefined && held.has(roles.developer));

// Why a member may not run a command here, or null when they may.
export function refusalFor(leaf: Leaf, channelId: string, held: Roles): string | null {
  const rule = ACCESS[leaf];
  if (!rule.channels.includes(channelId)) return `Use this command in ${rule.channels.map((id) => `<#${id}>`).join(' or ')}.`;
  if (rule.staff && !isStaff(held)) return 'Only staff can use this command.';
  if (rule.role && !held.has(rule.role)) return 'You are already registered. Ask staff if something is missing.';
  return null;
}
