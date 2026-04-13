import type { AuthLogService } from '../services/auth-log.service.js';
import {
  authLogSeverity,
  shouldLogAuthIssue,
  shouldLogSystemError,
  stripLeadingStatusEmoji,
  toSystemErrorSummary,
} from './error-message.js';

type LogContextValue = string | number | boolean | null | undefined;

export async function logAuthCommandFailure(input: {
  logs: AuthLogService;
  title: string;
  actorId?: string;
  subjectId?: string;
  error: unknown;
  userMessage: string;
  context?: Record<string, LogContextValue>;
}): Promise<void> {
  if (shouldLogSystemError(input.error)) {
    await input.logs.logSystemError({
      title: input.title,
      actorId: input.actorId,
      subjectId: input.subjectId,
      error: input.error,
      context: input.context,
    });
    return;
  }

  if (!shouldLogAuthIssue(input.error)) {
    return;
  }

  await input.logs.logAuthIssue({
    title: input.title,
    actorId: input.actorId,
    subjectId: input.subjectId,
    message: stripLeadingStatusEmoji(input.userMessage),
    severity: authLogSeverity(input.error),
    technicalDetails: toSystemErrorSummary(input.error),
    context: input.context,
  });
}
