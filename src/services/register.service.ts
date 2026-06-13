import type { Client, GuildMember, User } from 'discord.js';
import { ApiError } from '../api/errors.js';
import { ApiClient } from '../api/client.js';
import type {
  DiscordLookupResponse,
  LinkedAccountLookupResponse,
  ManualRegistrationChoice,
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
  | 'registration_method'
  | 'role_intents'
>;

interface FinalizedOperationContext {
  linkedPlatform: RegistrationPlatform;
  linkedAccountId: string;
  linkedAccountName: string | null;
  registrationMethod: string | null;
  resolvedDiscordUsername: string;
}

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
    platform: ManualRegistrationChoice;
    accountId: string;
    accountName?: string | null;
    discordUsername?: string | null;
    discordDisplayName?: string | null;
    reason?: string;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.manualRegister({
      actor_discord_id: input.actor.id,
      subject_discord_id: input.subject.id,
      platform: input.platform,
      platform_account_id: input.accountId,
      platform_account_name: input.accountName ?? undefined,
      game: input.game,
      reason: input.reason,
      discord_username: input.discordUsername ?? input.subject.username,
      discord_display_name: input.discordDisplayName ?? input.member.displayName,
    });

    return this.applyAndFinalize({
      operation,
      actor: input.actor,
      subject: input.subject,
      member: input.member,
      mode: 'manual',
      manualReason: input.reason,
      resolvedDiscordUsername: input.discordUsername ?? input.subject.username,
    });
  }

  async selfServiceRegister(input: {
    actor: User;
    member: GuildMember;
    game: SupportedGame;
    accountId: string;
    accountName?: string | null;
  }): Promise<RegistrationOperationResponse> {
    const operation = await this.api.selfServiceRegister({
      discord_user_id: input.actor.id,
      game: input.game,
      platform: '2k',
      platform_account_id: input.accountId,
      platform_account_name: input.accountName ?? undefined,
      discord_username: input.actor.username,
      discord_display_name: input.member.displayName,
    });

    return this.applyAndFinalize({
      operation,
      actor: input.actor,
      subject: input.actor,
      member: input.member,
      mode: 'self-service',
      resolvedDiscordUsername: input.actor.username,
    });
  }

  async lookupByDiscordId(discordId: string): Promise<DiscordLookupResponse> {
    return this.api.lookupByDiscordId(discordId);
  }

  async lookupByLinkedAccountId(linkedAccountId: string): Promise<LinkedAccountLookupResponse> {
    return this.api.lookupByLinkedAccountId(linkedAccountId);
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
    const sync = await this.finalizeOperationWithRoleSync(input);
    const context = this.buildFinalizedOperationContext(input);

    await this.logFinalizedOperation({
      ...input,
      ...context,
      appliedRoleIntents: sync.applied,
    }).catch((error) => {
      console.warn('Post-finalize auth logging failed', {
        operationId: input.operation.operation_id,
        mode: input.mode,
        error,
      });
    });

    return {
      ...input.operation,
      linked_platform: context.linkedPlatform,
      linked_account_id: context.linkedAccountId,
      linked_account_name: context.linkedAccountName,
      role_intents: sync.applied,
    };
  }

  private async finalizeOperationWithRoleSync(input: {
    operation: FinalizableOperation;
    member: GuildMember;
  }): Promise<{ applied: RegistrationOperationResponse['role_intents'] }> {
    try {
      const sync = await this.roleSync.applyRoleIntents(input.member, input.operation.role_intents);
      await this.api.finalizeRegistrationOperation(input.operation.operation_id, {
        result: 'succeeded',
        applied_role_intents: sync.applied,
        failure_code: null,
        failure_message: null,
      });
      return sync;
    } catch (error) {
      const failure = toFinalizeFailure(error);
      await this.api
        .finalizeRegistrationOperation(input.operation.operation_id, {
          result: 'failed',
          applied_role_intents: [],
          failure_code: failure.code,
          failure_message: failure.message,
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private buildFinalizedOperationContext(input: {
    operation: FinalizableOperation;
    subject: User;
    resolvedDiscordUsername?: string;
  }): FinalizedOperationContext {
    return {
      linkedPlatform: input.operation.linked_platform ?? 'steam',
      linkedAccountId: input.operation.linked_account_id ?? input.operation.steam_id,
      linkedAccountName: input.operation.linked_account_name ?? input.operation.steam_name ?? null,
      registrationMethod: input.operation.registration_method ?? null,
      resolvedDiscordUsername: input.resolvedDiscordUsername ?? input.subject.username,
    };
  }

  private async logFinalizedOperation(input: {
    operation: FinalizableOperation;
    actor: User;
    subject: User;
    member: GuildMember;
    mode: RegistrationMode;
    manualReason?: string;
    linkedPlatform: RegistrationPlatform;
    linkedAccountId: string;
    linkedAccountName: string | null;
    registrationMethod: string | null;
    resolvedDiscordUsername: string;
    appliedRoleIntents: readonly RegistrationOperationResponse['role_intents'][number][];
  }): Promise<void> {
    if (input.mode === 'manual') {
      await this.logs.logManualRegistrationCompleted({
        actorId: input.actor.id,
        subjectId: input.subject.id,
        discordDisplayName: input.member.displayName,
        discordUsername: input.resolvedDiscordUsername,
        linkedPlatform: input.linkedPlatform,
        accountId: input.linkedAccountId,
        accountName: input.linkedAccountName,
        registrationMethod: input.registrationMethod,
        game: input.operation.game,
        reason: input.manualReason ?? 'No reason provided.',
      });

      await this.logs.logRegistrationResult({
        actorId: input.actor.id,
        subjectId: input.subject.id,
        discordDisplayName: input.member.displayName,
        discordUsername: input.resolvedDiscordUsername,
        game: input.operation.game,
        linkedPlatform: input.linkedPlatform,
        accountId: input.linkedAccountId,
        accountName: input.linkedAccountName,
        registrationMethod: input.registrationMethod,
        appliedRoleIntents: input.appliedRoleIntents,
        mode: 'manual',
      });
      return;
    }

    if (input.mode === 'rank-role') {
      await this.logs.logRankRoleResult({
        actorId: input.actor.id,
        subjectId: input.subject.id,
        discordDisplayName: input.member.displayName,
        discordUsername: input.resolvedDiscordUsername,
        game: input.operation.game,
        appliedRoleIntents: input.appliedRoleIntents,
      });
      return;
    }

    await this.logs.logRegistrationResult({
      actorId: input.actor.id,
      subjectId: input.subject.id,
      discordDisplayName: input.member.displayName,
      discordUsername: input.resolvedDiscordUsername,
      game: input.operation.game,
      linkedPlatform: input.linkedPlatform,
      accountId: input.linkedAccountId,
      accountName: input.linkedAccountName,
      registrationMethod: input.registrationMethod,
      appliedRoleIntents: input.appliedRoleIntents,
      mode: 'self-service',
    });
  }
}

function toFinalizeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: error.name || 'ROLE_SYNC_FAILED', message: error.message };
  }
  return { code: 'ROLE_SYNC_FAILED', message: String(error) };
}
