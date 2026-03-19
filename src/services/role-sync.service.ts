import type { GuildMember } from 'discord.js';
import { ROLE_INTENTS } from '../config/constants.js';
import { config } from '../config/index.js';
import type { RoleIntent } from '../api/types.js';
import { ApiError } from '../api/errors.js';

export interface RoleSyncResult {
  applied: RoleIntent[];
  skipped: RoleIntent[];
}

const ROLE_ID_BY_INTENT: Record<Exclude<RoleIntent, 'remove_non_verified'>, string> = {
  [ROLE_INTENTS.grantCiv6Rank]: config.discord.roles.civ6Rank,
  [ROLE_INTENTS.grantCiv7Rank]: config.discord.roles.civ7Rank,
  [ROLE_INTENTS.grantNovice]: config.discord.roles.novice,
};

export class RoleSyncService {
  async applyRoleIntents(member: GuildMember, intents: readonly RoleIntent[]): Promise<RoleSyncResult> {
    const me = member.guild.members.me;
    if (!me?.permissions.has('ManageRoles')) {
      throw new ApiError({
        message: 'Bot lacks Manage Roles permission.',
        code: 'ROLE_SYNC_FORBIDDEN',
        status: 500,
      });
    }

    const applied: RoleIntent[] = [];
    const skipped: RoleIntent[] = [];

    for (const intent of intents) {
      if (intent === ROLE_INTENTS.removeNonVerified) {
        if (member.roles.cache.has(config.discord.roles.nonVerified)) {
          await member.roles.remove(config.discord.roles.nonVerified, 'Auth registration completed');
          applied.push(intent);
        } else {
          skipped.push(intent);
        }
        continue;
      }

      const roleId = ROLE_ID_BY_INTENT[intent as keyof typeof ROLE_ID_BY_INTENT];
      const role = member.guild.roles.cache.get(roleId);
      if (!role) {
        throw new ApiError({
          message: `Configured role not found for intent ${intent}.`,
          code: 'ROLE_SYNC_CONFIG_ERROR',
          status: 500,
        });
      }
      if (me.roles.highest.comparePositionTo(role) <= 0) {
        throw new ApiError({
          message: `Bot role is not high enough to manage ${role.name}.`,
          code: 'ROLE_SYNC_FORBIDDEN',
          status: 500,
        });
      }
      if (member.roles.cache.has(roleId)) {
        skipped.push(intent);
        continue;
      }
      await member.roles.add(roleId, 'Auth bot role synchronization');
      applied.push(intent);
    }

    return { applied, skipped };
  }
}
