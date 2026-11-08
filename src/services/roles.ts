import type { RoleIntent } from '../api/types.js';
import { ROLE_OF } from '../config/constants.js';
import { log } from '../utils/log.js';

// The parts of a GuildMember a role sync needs, so a test can stand one in.
type Member = Readonly<{
  id: string;
  roles: Readonly<{
    cache: Readonly<{ has(id: string): boolean }>;
    add(id: string, reason: string): Promise<unknown>;
    remove(id: string, reason: string): Promise<unknown>;
  }>;
}>;

export type RoleSync = Readonly<{ applied: RoleIntent[]; failed: RoleIntent[] }>;

const RETRY_MS = 1000;
const REASON = 'Auth registration';

async function attempt(member: Member, intents: readonly RoleIntent[], roleOf: typeof ROLE_OF): Promise<RoleSync> {
  const applied: RoleIntent[] = [];
  const failed: RoleIntent[] = [];
  for (const intent of intents) {
    const role = roleOf[intent];
    // A role left unset in the env is one the server does not use.
    if (!role) continue;
    const removing = intent === 'remove_non_verified';
    if (member.roles.cache.has(role) !== removing) continue;
    try {
      await (removing ? member.roles.remove(role, REASON) : member.roles.add(role, REASON));
      applied.push(intent);
    } catch (error) {
      log.warn(`role ${intent} not set for ${member.id}`, error instanceof Error ? error.message : error);
      failed.push(intent);
    }
  }
  return { applied, failed };
}

async function withRetry(member: Member, intents: readonly RoleIntent[], roleOf: typeof ROLE_OF, retryMs: number): Promise<RoleSync> {
  const first = await attempt(member, intents, roleOf);
  if (!first.failed.length) return first;
  await new Promise((resolve) => setTimeout(resolve, retryMs));
  const second = await attempt(member, first.failed, roleOf);
  return { applied: [...first.applied, ...second.applied], failed: second.failed };
}

// Sets the roles core-api names; whatever fails is tried once more, and what
// still fails is returned for staff to set by hand. Non-verified comes off only
// once every grant has landed, so no member is left with neither.
export async function syncRoles(
  member: Member,
  intents: readonly RoleIntent[],
  roleOf: typeof ROLE_OF = ROLE_OF,
  retryMs = RETRY_MS,
): Promise<RoleSync> {
  const granted = await withRetry(member, intents.filter((intent) => intent !== 'remove_non_verified'), roleOf, retryMs);
  if (!intents.includes('remove_non_verified')) return granted;
  if (granted.failed.length) {
    const held = roleOf.remove_non_verified && member.roles.cache.has(roleOf.remove_non_verified);
    return held ? { applied: granted.applied, failed: [...granted.failed, 'remove_non_verified'] } : granted;
  }
  const removed = await withRetry(member, ['remove_non_verified'], roleOf, retryMs);
  return { applied: [...granted.applied, ...removed.applied], failed: removed.failed };
}
