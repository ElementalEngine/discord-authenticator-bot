import type { ButtonInteraction, ChatInputCommandInteraction, GuildMember, User } from 'discord.js';
import { ApiError } from '../api/errors.js';
import type { RegistrationSessionStatusResponse } from '../api/types.js';
import type { SupportedGame } from '../config/types.js';
import { clearComponents } from '../ui/components/register.js';
import {
  buildRegistrationExpiredEmbed,
  buildRegistrationFailureEmbed,
  buildRegistrationSuccessEmbed,
  buildRegistrationValidatingEmbed,
} from '../ui/embeds/register.js';
import { safeEditReply } from '../utils/discord-safe.js';
import {
  authLogSeverity,
  shouldLogAuthIssue,
  shouldLogSystemError,
  stripLeadingStatusEmoji,
  toSystemErrorSummary,
  toUserErrorMessage,
} from '../utils/error-message.js';
import type { RegisterService } from './register.service.js';

interface ActiveWatch {
  timeout: ReturnType<typeof setTimeout> | null;
  expiresAtMs: number;
  statusRetries: number;
  completeRetries: number;
  lastStatus?: RegistrationSessionStatusResponse['status'];
}

interface WatchInput {
  interaction: ChatInputCommandInteraction | ButtonInteraction;
  sessionId: string;
  user: User;
  member: GuildMember;
  game: SupportedGame;
  expiresAt: string;
}

export class RegistrationSessionWatchService {
  private static readonly watches = new Map<string, ActiveWatch>();

  constructor(private readonly registerService: RegisterService) {}

  start(input: WatchInput): void {
    this.stop(input.sessionId);

    RegistrationSessionWatchService.watches.set(input.sessionId, {
      timeout: null,
      expiresAtMs: Date.parse(input.expiresAt),
      statusRetries: 0,
      completeRetries: 0,
      lastStatus: 'pending_auth',
    });

    this.schedule(input, 2500);
  }

  stop(sessionId: string): void {
    const existing = RegistrationSessionWatchService.watches.get(sessionId);
    if (existing) {
      if (existing.timeout) clearTimeout(existing.timeout);
      RegistrationSessionWatchService.watches.delete(sessionId);
    }
  }

  private schedule(input: WatchInput, delayMs: number): void {
    const watch = RegistrationSessionWatchService.watches.get(input.sessionId);
    if (!watch) return;
    watch.timeout = setTimeout(() => {
      void this.tick(input);
    }, delayMs);
  }

  private async tick(input: WatchInput): Promise<void> {
    const watch = RegistrationSessionWatchService.watches.get(input.sessionId);
    if (!watch) return;

    if (!Number.isFinite(watch.expiresAtMs) || Date.now() >= watch.expiresAtMs) {
      await this.handleExpired(input, watch);
      return;
    }

    let session: RegistrationSessionStatusResponse;
    try {
      session = await this.registerService.api.getRegistrationSession(input.sessionId);
      watch.statusRetries = 0;
    } catch (error) {
      await this.handlePollingError(input, watch, error);
      return;
    }

    switch (session.status) {
      case 'pending_auth':
        watch.lastStatus = session.status;
        this.schedule(input, 2500);
        return;
      case 'validating':
        await this.handleValidating(input, watch);
        return;
      case 'validated':
        await this.handleValidated(input, watch, session);
        return;
      case 'failed':
        await this.handleFailed(input, session);
        return;
      case 'expired':
        await this.handleExpired(input, watch, session.failure_code ?? 'REGISTRATION_SESSION_EXPIRED');
        return;
      case 'completed':
        this.stop(input.sessionId);
        await safeEditReply(input.interaction, { components: clearComponents() });
        return;
      default:
        this.schedule(input, 2500);
    }
  }

  private async handleValidating(input: WatchInput, watch: ActiveWatch): Promise<void> {
    if (watch.lastStatus !== 'validating') {
      await safeEditReply(input.interaction, {
        embeds: [buildRegistrationValidatingEmbed({ game: input.game })],
        components: clearComponents(),
      });
    }
    watch.lastStatus = 'validating';
    this.schedule(input, 2500);
  }

  private async handleValidated(
    input: WatchInput,
    watch: ActiveWatch,
    session: RegistrationSessionStatusResponse,
  ): Promise<void> {
    try {
      const result = await this.registerService.completeSelfServiceRegistration({
        sessionId: input.sessionId,
        actor: input.user,
        member: input.member,
      });
      this.stop(input.sessionId);
      await this.registerService.logAuthenticationCompleted({
        session,
        game: input.game,
        user: input.user,
        member: input.member,
      }).catch(() => undefined);
      await safeEditReply(input.interaction, {
        embeds: [
          buildRegistrationSuccessEmbed({
            game: result.game,
            steamId: result.steam_id,
            steamName: result.steam_name ?? session.linked_account_name ?? null,
            discordId: input.user.id,
            discordUsername: session.discord_username ?? input.user.username,
            discordDisplayName: input.member.displayName,
            roleIntents: result.role_intents,
          }),
        ],
        components: clearComponents(),
      });
    } catch (error) {
      if (this.isRetryableBackendError(error) && watch.completeRetries < 2) {
        watch.completeRetries += 1;
        this.schedule(input, 3000);
        return;
      }

      this.stop(input.sessionId);
      const userMessage = toUserErrorMessage(error);
      await safeEditReply(input.interaction, {
        embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(userMessage))],
        components: clearComponents(),
      });
      await this.logAuthIssue(input, {
        title: 'Registration auto-complete failed',
        error,
        message: stripLeadingStatusEmoji(userMessage),
        context: {
          session_id: input.sessionId,
          game: input.game,
          linked_account_id: session.linked_account_id ?? undefined,
        },
      });
    }
  }

  private async handleFailed(input: WatchInput, session: RegistrationSessionStatusResponse): Promise<void> {
    this.stop(input.sessionId);
    const failureMessage = session.failure_message ?? 'Registration could not be completed.';
    await safeEditReply(input.interaction, {
      embeds: [buildRegistrationFailureEmbed(failureMessage)],
      components: clearComponents(),
    });
    await this.registerService.logs.logAuthIssue({
      title: 'Registration could not be completed',
      actorId: input.user.id,
      subjectId: input.user.id,
      severity: 'warning',
      message: failureMessage,
      context: {
        session_id: input.sessionId,
        game: input.game,
        linked_account_id: session.linked_account_id ?? undefined,
        linked_account_name: session.linked_account_name ?? undefined,
      },
      technicalDetails: `${session.failure_code ?? 'UNKNOWN_FAILURE'}: ${failureMessage}`,
    }).catch(() => undefined);
  }

  private async handleExpired(
    input: WatchInput,
    watch: ActiveWatch,
    technicalDetails = 'REGISTRATION_SESSION_EXPIRED',
  ): Promise<void> {
    this.stop(input.sessionId);
    await safeEditReply(input.interaction, {
      embeds: [buildRegistrationExpiredEmbed()],
      components: clearComponents(),
    });
    if (watch.lastStatus && watch.lastStatus !== 'pending_auth') {
      await this.registerService.logs.logAuthIssue({
        title: 'Registration session expired',
        actorId: input.user.id,
        subjectId: input.user.id,
        severity: 'info',
        message: 'Registration session expired before the flow could finish.',
        context: { session_id: input.sessionId, game: input.game, last_status: watch.lastStatus },
        technicalDetails,
      }).catch(() => undefined);
    }
  }

  private async handlePollingError(input: WatchInput, watch: ActiveWatch, error: unknown): Promise<void> {
    if (this.isRetryableBackendError(error) && watch.statusRetries < 3) {
      watch.statusRetries += 1;
      this.schedule(input, 2500);
      return;
    }

    this.stop(input.sessionId);
    const userMessage = toUserErrorMessage(error);
    await safeEditReply(input.interaction, {
      embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(userMessage))],
      components: clearComponents(),
    });
    await this.logAuthIssue(input, {
      title: 'Registration session polling failed',
      error,
      message: stripLeadingStatusEmoji(userMessage),
      context: { session_id: input.sessionId, game: input.game },
    });
  }

  private isRetryableBackendError(error: unknown): boolean {
    return error instanceof ApiError && error.retryable;
  }

  private async logAuthIssue(
    input: WatchInput,
    details: {
      title: string;
      error: unknown;
      message: string;
      context?: Record<string, string | number | boolean | null | undefined>;
    },
  ): Promise<void> {
    if (shouldLogSystemError(details.error)) {
      await this.registerService.logs.logSystemError({
        title: details.title,
        actorId: input.user.id,
        subjectId: input.user.id,
        error: details.error,
        context: details.context,
      }).catch(() => undefined);
      return;
    }

    if (!shouldLogAuthIssue(details.error)) {
      return;
    }

    await this.registerService.logs.logAuthIssue({
      title: details.title,
      actorId: input.user.id,
      subjectId: input.user.id,
      severity: authLogSeverity(details.error),
      message: details.message,
      context: details.context,
      technicalDetails: toSystemErrorSummary(details.error),
    }).catch(() => undefined);
  }
}
