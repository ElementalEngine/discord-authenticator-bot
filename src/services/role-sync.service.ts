import type { GuildMember, Role } from 'discord.js';
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

type GrantIntent = Exclude<RoleIntent, 'remove_non_verified'>;

interface PlannedMutation {
  intent: RoleIntent;
  action: 'add' | 'remove' | 'skip';
  roleId: string;
}

export class RoleSyncService {
  async applyRoleIntents(member: GuildMember, intents: readonly RoleIntent[]): Promise<RoleSyncResult> {
    const plan = this.preflight(member, intents);

    const applied: RoleIntent[] = [];
    const skipped: RoleIntent[] = [];

    for (const step of plan) {
      if (step.action === 'skip') {
        skipped.push(step.intent);
        continue;
      }
      if (step.action === 'remove') {
        await member.roles.remove(step.roleId, 'Auth registration completed');
        applied.push(step.intent);
        continue;
      }
      await member.roles.add(step.roleId, 'Auth bot role synchronization');
      applied.push(step.intent);
    }

    return { applied, skipped };
  }

  private preflight(member: GuildMember, intents: readonly RoleIntent[]): PlannedMutation[] {
    const me = member.guild.members.me;
    if (!me?.permissions.has('ManageRoles')) {
      throw new ApiError({
        message: 'Bot lacks Manage Roles permission.',
        code: 'ROLE_SYNC_FORBIDDEN',
        status: 500,
      });
    }

    const plan: PlannedMutation[] = [];

    for (const intent of intents) {
      if (intent === ROLE_INTENTS.removeNonVerified) {
        const nonVerifiedId = config.discord.roles.nonVerified;
        if (!member.roles.cache.has(nonVerifiedId)) {
          plan.push({ intent, action: 'skip', roleId: nonVerifiedId });
          continue;
        }
        this.assertManageable(me, member, nonVerifiedId, intent);
        plan.push({ intent, action: 'remove', roleId: nonVerifiedId });
        continue;
      }

      const roleId = ROLE_ID_BY_INTENT[intent as GrantIntent];
      if (typeof roleId !== 'string') {
        throw new ApiError({
          message: `Unknown role intent: ${intent}.`,
          code: 'ROLE_SYNC_CONFIG_ERROR',
          status: 500,
        });
      }
      if (member.roles.cache.has(roleId)) {
        plan.push({ intent, action: 'skip', roleId });
        continue;
      }
      this.assertManageable(me, member, roleId, intent);
      plan.push({ intent, action: 'add', roleId });
    }

    return plan;
  }

  private assertManageable(me: GuildMember, member: GuildMember, roleId: string, intent: RoleIntent): Role {
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
    return role;
  }
}
