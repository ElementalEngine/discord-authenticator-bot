import type { ChatInputCommandInteraction, GuildMember, User } from 'discord.js';
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
import { shouldLogSystemError, stripLeadingStatusEmoji, toUserErrorMessage } from '../utils/error-message.js';
import type { RegisterService } from './register.service.js';

interface ActiveWatch {
  timeout: NodeJS.Timeout;
  expiresAtMs: number;
  statusRetries: number;
  completeRetries: number;
  lastStatus?: RegistrationSessionStatusResponse['status'];
}

export class RegistrationSessionWatchService {
  private static readonly watches = new Map<string, ActiveWatch>();

  constructor(private readonly registerService: RegisterService) {}

  start(input: {
    interaction: ChatInputCommandInteraction;
    sessionId: string;
    user: User;
    member: GuildMember;
    game: SupportedGame;
    expiresAt: string;
  }): void {
    this.stop(input.sessionId);

    RegistrationSessionWatchService.watches.set(input.sessionId, {
      timeout: setTimeout(() => undefined, 0),
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
      clearTimeout(existing.timeout);
      RegistrationSessionWatchService.watches.delete(sessionId);
    }
  }

  private schedule(
    input: {
      interaction: ChatInputCommandInteraction;
      sessionId: string;
      user: User;
      member: GuildMember;
      game: SupportedGame;
      expiresAt: string;
    },
    delayMs: number,
  ): void {
    const watch = RegistrationSessionWatchService.watches.get(input.sessionId);
    if (!watch) return;
    watch.timeout = setTimeout(() => {
      void this.tick(input);
    }, delayMs);
  }

  private async tick(input: {
    interaction: ChatInputCommandInteraction;
    sessionId: string;
    user: User;
    member: GuildMember;
    game: SupportedGame;
    expiresAt: string;
  }): Promise<void> {
    const watch = RegistrationSessionWatchService.watches.get(input.sessionId);
    if (!watch) return;

    if (!Number.isFinite(watch.expiresAtMs) || Date.now() >= watch.expiresAtMs) {
      this.stop(input.sessionId);
      await safeEditReply(input.interaction, {
        embeds: [buildRegistrationExpiredEmbed()],
        components: clearComponents(),
      });
      return;
    }

    let session: RegistrationSessionStatusResponse;
    try {
      session = await this.registerService.api.getRegistrationSession(input.sessionId);
      watch.statusRetries = 0;
    } catch (error) {
      if (this.isRetryableBackendError(error) && watch.statusRetries < 3) {
        watch.statusRetries += 1;
        this.schedule(input, 2500);
        return;
      }

      this.stop(input.sessionId);
      await safeEditReply(input.interaction, {
        embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(toUserErrorMessage(error)))],
        components: clearComponents(),
      });
      if (shouldLogSystemError(error)) {
        await this.registerService.logs.logSystemError({
          title: 'Registration session polling failed',
          actorId: input.user.id,
          subjectId: input.user.id,
          error,
          context: { session_id: input.sessionId, game: input.game },
        });
      }
      return;
    }

    switch (session.status) {
      case 'pending_auth':
        watch.lastStatus = session.status;
        this.schedule(input, 2500);
        return;
      case 'validating':
        if (watch.lastStatus !== 'validating') {
          await safeEditReply(input.interaction, {
            embeds: [buildRegistrationValidatingEmbed({ game: input.game })],
            components: clearComponents(),
          });
        }
        watch.lastStatus = session.status;
        this.schedule(input, 2500);
        return;
      case 'validated':
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
          return;
        } catch (error) {
          if (this.isRetryableBackendError(error) && watch.completeRetries < 2) {
            watch.completeRetries += 1;
            this.schedule(input, 3000);
            return;
          }

          this.stop(input.sessionId);
          await safeEditReply(input.interaction, {
            embeds: [buildRegistrationFailureEmbed(stripLeadingStatusEmoji(toUserErrorMessage(error)))],
            components: clearComponents(),
          });
          if (shouldLogSystemError(error)) {
            await this.registerService.logs.logSystemError({
              title: 'Registration auto-complete failed',
              actorId: input.user.id,
              subjectId: input.user.id,
              error,
              context: { session_id: input.sessionId, game: input.game },
            });
          }
          return;
        }
      case 'failed':
        this.stop(input.sessionId);
        await safeEditReply(input.interaction, {
          embeds: [buildRegistrationFailureEmbed(session.failure_message ?? 'Registration could not be completed.')],
          components: clearComponents(),
        });
        return;
      case 'expired':
        this.stop(input.sessionId);
        await safeEditReply(input.interaction, {
          embeds: [buildRegistrationExpiredEmbed()],
          components: clearComponents(),
        });
        return;
      case 'completed':
        this.stop(input.sessionId);
        await safeEditReply(input.interaction, { components: clearComponents() });
        return;
      default:
        this.schedule(input, 2500);
    }
  }

  private isRetryableBackendError(error: unknown): boolean {
    return error instanceof ApiError && error.retryable;
  }
}
