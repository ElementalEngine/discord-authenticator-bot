import type { GuildMember, Role } from 'discord.js';
import { ROLE_INTENTS } from '../config/constants.js';
import { config } from '../config/index.js';
import type { RoleIntent } from '../api/types.js';
import { ApiError } from '../api/errors.js';

export interface RoleSyncResult {
  applied: RoleIntent[];
  skipped: RoleIntent[];
}

type RemoveIntent = 'remove_non_verified';
type GrantIntent = Exclude<RoleIntent, RemoveIntent>;

const GRANT_ROLE_ID_BY_INTENT: Record<GrantIntent, string | undefined> = {
  [ROLE_INTENTS.grantCiv6Rank]: config.discord.roles.civ6Rank,
  [ROLE_INTENTS.grantCiv7Rank]: config.discord.roles.civ7Rank,
  [ROLE_INTENTS.grantNovice]: config.discord.roles.novice,
  [ROLE_INTENTS.grantServerNews]: config.discord.roles.serverNews,
  [ROLE_INTENTS.grantCiv6News]: config.discord.roles.civ6News,
  [ROLE_INTENTS.grantCiv7News]: config.discord.roles.civ7News,
  [ROLE_INTENTS.grantPcSteam]: config.discord.roles.pcSteam,
  [ROLE_INTENTS.grant2kCrossplatform]: config.discord.roles.twoKCrossplatform,
};

const REMOVE_ROLE_ID_BY_INTENT: Record<RemoveIntent, string | undefined> = {
  [ROLE_INTENTS.removeNonVerified]: config.discord.roles.nonVerified,
};

function isRemoveIntent(intent: RoleIntent): intent is RemoveIntent {
  return intent === ROLE_INTENTS.removeNonVerified;
}

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
      if (isRemoveIntent(intent)) {
        const roleId = REMOVE_ROLE_ID_BY_INTENT[intent];
        if (!roleId) {
          console.warn(`[role-sync] Skipping ${intent}: role id not configured.`);
          plan.push({ intent, action: 'skip', roleId: '' });
          continue;
        }
        if (!member.roles.cache.has(roleId)) {
          plan.push({ intent, action: 'skip', roleId });
          continue;
        }
        this.assertManageable(me, member, roleId, intent);
        plan.push({ intent, action: 'remove', roleId });
        continue;
      }

      // Unknown intents (a newer backend) and intents whose role id env is unset both
      // land here as undefined: skip and log rather than failing the registration.
      const roleId = GRANT_ROLE_ID_BY_INTENT[intent];
      if (!roleId) {
        console.warn(`[role-sync] Skipping ${intent}: role id not configured or intent unknown.`);
        plan.push({ intent, action: 'skip', roleId: '' });
        continue;
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
