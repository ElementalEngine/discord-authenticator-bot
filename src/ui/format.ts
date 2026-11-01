import type { RoleIntent, Standing } from '../api/types.js';
import { ROLE_OF } from '../config/constants.js';

export const when = (iso: string, style: 'f' | 'R' | 'D'): string => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;
export const who = (id: string): string => `<@${id}> \`${id}\``;

const PLATFORMS: Readonly<Record<string, string>> = { steam: 'Steam', '2k': '2K', epic: 'Epic', xbox: 'Xbox' };

export const account = (platform: string | null | undefined, id: string, name?: string | null): string =>
  `${(platform && PLATFORMS[platform]) ?? 'Account'} \`${id}\`${name ? ` (${name})` : ''}`;

export const role = (intent: RoleIntent): string => (ROLE_OF[intent] ? `<@&${ROLE_OF[intent]}>` : intent);

// The roles a sync gave, leaving out the one it took away.
export const granted = (intents: readonly RoleIntent[]): RoleIntent[] => intents.filter((intent) => intent !== 'remove_non_verified');

export function standing(record: Standing): string[] {
  const tiers = Object.entries(record.tiers).filter(([, tier]) => tier > 0);
  return [
    ...(record.suspended ? [`suspended${record.ends ? ` until ${when(record.ends, 'f')}` : ''}${record.active_category ? ` (${record.active_category})` : ''}`] : []),
    ...(tiers.length ? [`tiers: ${tiers.map(([category, tier]) => `${category} ${tier}`).join(', ')}`] : []),
    ...(record.at_ban_threshold ? ['at the ban threshold'] : []),
  ];
}
