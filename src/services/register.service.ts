import type { Client, GuildMember, User } from 'discord.js';
import { ApiClient } from '../api/client.js';
import type {
  AccountLookupResponse,
  RegistrationOperationResponse,
  RegistrationPlatform,
  RegistrationSessionStatusResponse,
} from '../api/types.js';
import type { SupportedGame } from '../config/types.js';
import { AuthLogService } from './auth-log.service.js';
import { RoleSyncService } from './role-sync.service.js';

type RegistrationMode = 'self-service' | 'manual' | 'rank-role';

type FinalizableOperation = Pick<
  RegistrationOperationResponse,
  | 'operation_id'
  | 'discord_user_id'
  | 'game'
  | 'steam_id'
  | 'steam_name'
  | 'linked_platform'
  | 'linked_account_id'
  | 'linked_account_name'
  | 'role_intents'
>;

export class RegisterService {
  readonly api: ApiClient;
  readonly roleSync: RoleSyncService;
  readonly logs: AuthLogService;

  constructor(client: Client, api = new ApiClient()) {
    this.api = api;
    this.roleSync = new RoleSyncService();
    this.logs = new AuthLogService(client);
  }

  async createRegistrationSession(discordUserId: string, game: SupportedGame) {
    return this.api.createRegistrationSession({ discord_user_id: discordUserId, game });
  }

  async completeSelfServiceRegistration(input: {
    sessionId: string;
    actor: User;
    member: GuildMember;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.completeRegistrationSession({
      sessionId: input.sessionId,
      discord_user_id: input.actor.id,
    });

    return this.applyAndFinalize({
      operation,
      actor: input.actor,
      subject: input.actor,
      member: input.member,
      mode: 'self-service',
    });
  }

  async addRankRole(input: {
    user: User;
    game: SupportedGame;
    member: GuildMember;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.requestRankRole({
      discord_user_id: input.user.id,
      game: input.game,
    });

    return this.applyAndFinalize({
      operation,
      actor: input.user,
      subject: input.user,
      member: input.member,
      mode: 'rank-role',
    });
  }

  async manualRegister(input: {
    actor: User;
    subject: User;
    member: GuildMember;
    game: SupportedGame;
    platform: RegistrationPlatform;
    accountId: string;
    accountName: string;
    discordUsername: string;
    reason?: string;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.manualRegister({
      actor_discord_id: input.actor.id,
      subject_discord_id: input.subject.id,
      platform: input.platform,
      platform_account_id: input.accountId,
      platform_account_name: input.accountName,
      game: input.game,
      reason: input.reason,
      discord_username: input.discordUsername,
      discord_display_name: input.member.displayName,
    });

    return this.applyAndFinalize({
      operation,
      actor: input.actor,
      subject: input.subject,
      member: input.member,
      mode: 'manual',
      manualReason: input.reason,
      resolvedDiscordUsername: input.discordUsername,
    });
  }

  async lookupByDiscordId(discordId: string): Promise<AccountLookupResponse> {
    return this.api.lookupByDiscordId(discordId);
  }

  async lookupBySteamId(steamId: string): Promise<AccountLookupResponse> {
    return this.api.lookupBySteamId(steamId);
  }

  async logAuthenticationCompleted(input: {
    session: RegistrationSessionStatusResponse;
    game: SupportedGame;
    user: User;
    member: GuildMember;
  }): Promise<void> {
    await this.logs.logAuthenticationCompleted({
      discordId: input.user.id,
      discordDisplayName: input.member.displayName,
      discordUsername: input.session.discord_username ?? input.user.username,
      locale: input.session.discord_locale ?? null,
      verified: input.session.discord_verified ?? null,
      mfaEnabled: input.session.discord_mfa_enabled ?? null,
      steamId: input.session.linked_account_id ?? '',
      steamName: input.session.linked_account_name ?? null,
      game: input.game,
    });
  }

  private async applyAndFinalize(input: {
    operation: FinalizableOperation;
    actor: User;
    subject: User;
    member: GuildMember;
    mode: RegistrationMode;
    manualReason?: string;
    resolvedDiscordUsername?: string;
  }): Promise<RegistrationOperationResponse> {
    try {
      const sync = await this.roleSync.applyRoleIntents(input.member, input.operation.role_intents);
      await this.api.finalizeRegistrationOperation(input.operation.operation_id, {
        result: 'succeeded',
        applied_role_intents: sync.applied,
        failure_code: null,
        failure_message: null,
      });

      const linkedPlatform = input.operation.linked_platform ?? 'steam';
      const linkedAccountId = input.operation.linked_account_id ?? input.operation.steam_id;
      const linkedAccountName = input.operation.linked_account_name ?? input.operation.steam_name ?? null;
      const resolvedDiscordUsername = input.resolvedDiscordUsername ?? input.subject.username;

      if (input.mode === 'manual') {
        await this.logs.logManualRegistrationCompleted({
          actorId: input.actor.id,
          subjectId: input.subject.id,
          discordDisplayName: input.member.displayName,
          discordUsername: resolvedDiscordUsername,
          linkedPlatform,
          accountId: linkedAccountId,
          accountName: linkedAccountName,
          game: input.operation.game,
          reason: input.manualReason ?? 'No reason provided.',
        });

        await this.logs.logRegistrationResult({
          actorId: input.actor.id,
          subjectId: input.subject.id,
          discordDisplayName: input.member.displayName,
          discordUsername: resolvedDiscordUsername,
          game: input.operation.game,
          linkedPlatform,
          accountId: linkedAccountId,
          accountName: linkedAccountName,
          appliedRoleIntents: sync.applied,
          mode: 'manual',
        });
      } else if (input.mode === 'rank-role') {
        await this.logs.logRankRoleResult({
          actorId: input.actor.id,
          subjectId: input.subject.id,
          discordDisplayName: input.member.displayName,
          discordUsername: resolvedDiscordUsername,
          game: input.operation.game,
          appliedRoleIntents: sync.applied,
        });
      } else {
        await this.logs.logRegistrationResult({
          actorId: input.actor.id,
          subjectId: input.subject.id,
          discordDisplayName: input.member.displayName,
          discordUsername: resolvedDiscordUsername,
          game: input.operation.game,
          linkedPlatform,
          accountId: linkedAccountId,
          accountName: linkedAccountName,
          appliedRoleIntents: sync.applied,
          mode: 'self-service',
        });
      }

      return {
        ...input.operation,
        linked_platform: linkedPlatform,
        linked_account_id: linkedAccountId,
        linked_account_name: linkedAccountName,
        role_intents: sync.applied,
      };
    } catch (error) {
      await this.api
        .finalizeRegistrationOperation(input.operation.operation_id, {
          result: 'failed',
          applied_role_intents: [],
          failure_code: error instanceof Error ? error.name : 'ROLE_SYNC_FAILED',
          failure_message: error instanceof Error ? error.message : String(error),
        })
        .catch(() => undefined);
      throw error;
    }
  }
}