import { randomBytes } from 'node:crypto';

import { ApiError } from '../api/errors.js';
import type { Tone } from './kit.js';

// A rule the user broke, said back to them; the router renders it.
export class Refusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Refusal';
  }
}

export function refuse(message: string): never {
  throw new Refusal(message);
}

export type Failure = Readonly<{
  tone: Extract<Tone, 'refused' | 'failed'>;
  text: string;
  // Staff are told: the fault is ours, not the player's.
  staff: boolean;
}>;

const OURS = "Registration isn't available right now. Staff have been told.";
const NO_ANSWER = "The league server didn't answer. Try again in a minute.";

const unreachable = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError' || (error instanceof TypeError && error.message === 'fetch failed'));

// No answer, or a server error with none of core-api's detail: a write may have landed.
export const unanswered = (error: unknown): boolean => unreachable(error) || (error instanceof ApiError && !error.error && error.status >= 500);

// What a player or staff member reads when something did not happen. core-api's
// refusals are written for players; its auth and validation failures are not.
export function failureOf(error: unknown): Failure {
  if (error instanceof Refusal) return { tone: 'refused', text: error.message, staff: false };
  if (unanswered(error)) return { tone: 'failed', text: NO_ANSWER, staff: false };
  if (error instanceof ApiError) {
    const detail = error.error;
    const ref = detail?.correlation_id ? ` (ref ${detail.correlation_id})` : '';
    if (!detail) return { tone: 'failed', text: OURS, staff: true };
    if (error.status === 401 || error.status === 403 || error.status === 422 || detail.code.endsWith('MISCONFIGURED')) {
      return { tone: 'failed', text: `${OURS}${ref}`, staff: true };
    }
    if (error.status < 500) return { tone: 'refused', text: `${detail.message}${ref}`, staff: false };
    return { tone: 'failed', text: `${detail.message}${ref}`, staff: !detail.retryable };
  }
  return { tone: 'failed', text: `Something went wrong. Staff have been told. (ref ${randomBytes(3).toString('hex')})`, staff: true };
}

// Whether a Steam sign-in should wait for its next poll rather than end: an
// outage core-api calls retryable, or no answer at all. A bug of ours is not waited out.
export function waitOut(error: unknown): boolean {
  if (!(error instanceof ApiError)) return unreachable(error);
  return error.status >= 500 && (error.error === null || error.error.retryable === true);
}
