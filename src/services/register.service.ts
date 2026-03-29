import type { Client, GuildMember, User } from 'discord.js';
import { ApiClient } from '../api/client.js';
import type {
  AccountLookupResponse,
  RegistrationOperationResponse,
  RegistrationSessionStatusResponse,
} from '../api/types.js';
import type { SupportedGame } from '../config/types.js';
import { AuthLogService } from './auth-log.service.js';
import { RoleSyncService } from './role-sync.service.js';

type RegistrationMode = 'self-service' | 'manual';

type FinalizableOperation = Pick<
  RegistrationOperationResponse,
  'operation_id' | 'discord_user_id' | 'game' | 'steam_id' | 'role_intents'
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
    discordUserId: string;
    member: GuildMember;
    validatedSession?: RegistrationSessionStatusResponse;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.completeRegistrationSession({
      sessionId: input.sessionId,
      discord_user_id: input.discordUserId,
    });

    return this.applyAndFinalize({
      operation,
      actorId: input.discordUserId,
      subjectId: input.member.id,
      member: input.member,
      mode: 'self-service',
      validatedSession: input.validatedSession,
    });
  }

  async addRankRole(input: {
    userId: string;
    game: SupportedGame;
    member: GuildMember;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.requestRankRole({
      discord_user_id: input.userId,
      game: input.game,
    });

    return this.applyAndFinalize({
      operation,
      actorId: input.userId,
      subjectId: input.member.id,
      member: input.member,
      mode: 'self-service',
    });
  }

  async manualRegister(input: {
    actor: User;
    subject: User;
    member: GuildMember;
    game: SupportedGame;
    steamId: string;
    reason: string;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.manualRegister({
      actor_discord_id: input.actor.id,
      subject_discord_id: input.subject.id,
      steam_id: input.steamId,
      game: input.game,
      reason: input.reason,
    });

    return this.applyAndFinalize({
      operation,
      actorId: input.actor.id,
      subjectId: input.subject.id,
      member: input.member,
      mode: 'manual',
    });
  }

  async lookupByDiscordId(discordId: string): Promise<AccountLookupResponse> {
    return this.api.lookupByDiscordId(discordId);
  }

  async lookupBySteamId(steamId: string): Promise<AccountLookupResponse> {
    return this.api.lookupBySteamId(steamId);
  }

  private async applyAndFinalize(input: {
    operation: FinalizableOperation;
    actorId: string;
    subjectId: string;
    member: GuildMember;
    mode: RegistrationMode;
    validatedSession?: RegistrationSessionStatusResponse;
  }): Promise<RegistrationOperationResponse> {
    try {
      const sync = await this.roleSync.applyRoleIntents(input.member, input.operation.role_intents);
      await this.api.finalizeRegistrationOperation(input.operation.operation_id, {
        result: 'succeeded',
        applied_role_intents: sync.applied,
        failure_code: null,
        failure_message: null,
      });
      await this.logs.logRegistrationResult({
        actorId: input.actorId,
        subjectId: input.subjectId,
        game: input.operation.game,
        steamId: input.operation.steam_id,
        steamName: input.validatedSession?.linked_account_name,
        appliedRoleIntents: sync.applied,
        mode: input.mode,
        usernameSnapshot: input.validatedSession?.oauth_username_snapshot ?? null,
        displayNameSnapshot: input.validatedSession?.oauth_display_name_snapshot ?? null,
      });
      return { ...input.operation, role_intents: sync.applied };
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
