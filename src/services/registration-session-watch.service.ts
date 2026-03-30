import { ApiError } from '../api/errors.js';
import type { RegistrationSessionStatusResponse } from '../api/types.js';
import type { GuildMember, ChatInputCommandInteraction } from 'discord.js';
import {
  buildRegistrationCompletedEmbed,
  buildRegistrationExpiredEmbed,
  buildRegistrationFailureEmbed,
  buildRegistrationSuccessEmbed,
} from '../ui/embeds/register.js';
import { clearComponents } from '../ui/components/register.js';
import { safeEditReply } from '../utils/discord-safe.js';
import { toUserErrorMessage } from '../utils/error-message.js';
import type { RegisterService } from './register.service.js';

const POLL_INTERVAL_MS = 3_000;
const MAX_CONSECUTIVE_STATUS_RETRIES = 4;
const MAX_COMPLETE_RETRIES = 1;
const WATCH_DEADLINE_GRACE_MS = 5_000;

type CachedCommandInteraction = ChatInputCommandInteraction<'cached'>;

type WatchInput = {
  sessionId: string;
  expiresAt: string;
  interaction: CachedCommandInteraction;
  member: GuildMember;
  services: RegisterService;
};

type WatchState = {
  cancelled: boolean;
  authenticationLogged: boolean;
};

const activeWatches = new Map<string, WatchState>();

export function startRegistrationSessionWatch(input: WatchInput): void {
  stopRegistrationSessionWatch(input.sessionId);

  const state: WatchState = {
    cancelled: false,
    authenticationLogged: false,
  };
  activeWatches.set(input.sessionId, state);

  void watchRegistrationSession(input, state).finally(() => {
    const current = activeWatches.get(input.sessionId);
    if (current === state) activeWatches.delete(input.sessionId);
  });
}

export function stopRegistrationSessionWatch(sessionId: string): void {
  const state = activeWatches.get(sessionId);
  if (state) state.cancelled = true;
  activeWatches.delete(sessionId);
}

async function watchRegistrationSession(input: WatchInput, state: WatchState): Promise<void> {
  const deadlineMs = resolveWatchDeadline(input.expiresAt);
  let consecutiveStatusRetries = 0;
  let completionRetries = 0;

  while (!state.cancelled) {
    if (Date.now() >= deadlineMs) {
      await safeEditReply(input.interaction, {
        content: null,
        embeds: [buildRegistrationExpiredEmbed()],
        components: clearComponents(),
      }).catch(() => undefined);
      return;
    }

    await sleep(POLL_INTERVAL_MS);
    if (state.cancelled) return;

    let status: RegistrationSessionStatusResponse;
    try {
      status = await input.services.api.getRegistrationSession(input.sessionId);
      consecutiveStatusRetries = 0;
    } catch (error) {
      if (isRetryableBackendError(error)) {
        consecutiveStatusRetries += 1;
        if (consecutiveStatusRetries <= MAX_CONSECUTIVE_STATUS_RETRIES) {
          continue;
        }
      }

      await safeEditReply(input.interaction, {
        content: toUserErrorMessage(error),
        embeds: [],
        components: clearComponents(),
      }).catch(() => undefined);
      await input.services.logs.logSystemError({
        title: 'Registration session watch failed',
        actorId: input.interaction.user.id,
        subjectId: input.member.id,
        error,
      });
      return;
    }

    switch (status.status) {
      case 'pending_auth':
      case 'validating':
        continue;
      case 'validated': {
        if (!state.authenticationLogged) {
          state.authenticationLogged = true;
          await input.services.logs.logSuccessfulAuthentication({
            userId: input.interaction.user.id,
            session: status,
          }).catch(() => undefined);
        }

        try {
          const result = await input.services.completeSelfServiceRegistration({
            sessionId: input.sessionId,
            discordUserId: input.interaction.user.id,
            member: input.member,
            validatedSession: status,
          });
          await safeEditReply(input.interaction, {
            content: null,
            embeds: [
              buildRegistrationSuccessEmbed({
                game: result.game,
                discordId: input.interaction.user.id,
                discordDisplayName: input.member.displayName,
                discordUsername: input.interaction.user.username,
                steamId: result.steam_id,
                steamName: status.linked_account_name,
                roleIntents: result.role_intents,
              }),
            ],
            components: clearComponents(),
          }).catch(() => undefined);
          return;
        } catch (error) {
          if (isRetryableBackendError(error) && completionRetries < MAX_COMPLETE_RETRIES) {
            completionRetries += 1;
            continue;
          }

          await safeEditReply(input.interaction, {
            content: toUserErrorMessage(error),
            embeds: [],
            components: clearComponents(),
          }).catch(() => undefined);
          await input.services.logs.logSystemError({
            title: 'Registration auto-complete failed',
            actorId: input.interaction.user.id,
            subjectId: input.member.id,
            error,
          });
          return;
        }
      }
      case 'failed':
        await safeEditReply(input.interaction, {
          content: null,
          embeds: [
            buildRegistrationFailureEmbed({
              message: status.failure_message ?? 'Registration could not be completed. Please start again.',
            }),
          ],
          components: clearComponents(),
        }).catch(() => undefined);
        return;
      case 'expired':
        await safeEditReply(input.interaction, {
          content: null,
          embeds: [buildRegistrationExpiredEmbed()],
          components: clearComponents(),
        }).catch(() => undefined);
        return;
      case 'completed':
        await safeEditReply(input.interaction, {
          content: null,
          embeds: [buildRegistrationCompletedEmbed()],
          components: clearComponents(),
        }).catch(() => undefined);
        return;
      default:
        return;
    }
  }
}

function isRetryableBackendError(error: unknown): error is ApiError {
  return error instanceof ApiError && ['BACKEND_UNAVAILABLE', 'BACKEND_TIMEOUT', 'HTTP_502'].includes(error.code);
}

function resolveWatchDeadline(expiresAt: string): number {
  const parsed = Date.parse(expiresAt);
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  return base + WATCH_DEADLINE_GRACE_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
