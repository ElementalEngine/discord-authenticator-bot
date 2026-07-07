import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../src/api/errors.js';
import {
  authLogSeverity,
  shouldLogAuthIssue,
  shouldLogSystemError,
  stripLeadingStatusEmoji,
  toUserErrorMessage,
} from '../src/utils/error-message.js';

const apiError = (code: string, status: number, message = 'msg', retryable = false): ApiError =>
  new ApiError({ message, code, status, retryable });

test('transient backend failures map to the unavailable message', () => {
  for (const code of ['BACKEND_TIMEOUT', 'BACKEND_UNAVAILABLE', 'REGISTRATION_START_FAILED']) {
    assert.match(toUserErrorMessage(apiError(code, 503)), /temporarily unavailable/);
  }
});

test('user-actionable auth codes pass the backend message through', () => {
  const message = 'Make your Steam profile public.';
  assert.equal(toUserErrorMessage(apiError('STEAM_PROFILE_PRIVATE', 400, message)).endsWith(message), true);
});

test('session-not-ready maps to the info-style waiting message', () => {
  assert.match(toUserErrorMessage(apiError('REGISTRATION_SESSION_NOT_READY', 409)), /still running/);
});

test('unknown 5xx codes map to the unexpected-backend message', () => {
  assert.match(toUserErrorMessage(apiError('SOMETHING_NEW', 502)), /unexpected backend error/);
});

test('non-ApiError values fall back safely', () => {
  assert.match(toUserErrorMessage(new Error('boom')), /boom/);
  assert.match(toUserErrorMessage('nonsense'), /Something went wrong/);
});

test('shouldLogSystemError: expected auth codes are not system errors', () => {
  assert.equal(shouldLogSystemError(apiError('STEAM_OWNERSHIP_MISSING', 400)), false);
  assert.equal(shouldLogSystemError(apiError('WEIRD_CODE', 502, 'x', true)), true);
  assert.equal(shouldLogSystemError(new Error('boom')), true);
});

test('shouldLogAuthIssue filters only low-value codes', () => {
  assert.equal(shouldLogAuthIssue(apiError('REGISTRATION_SESSION_NOT_READY', 409)), false);
  assert.equal(shouldLogAuthIssue(apiError('STEAM_PROFILE_PRIVATE', 400)), true);
});

test('authLogSeverity: info codes report info, expected codes warning, system errors error', () => {
  assert.equal(authLogSeverity(apiError('ACCOUNT_NOT_FOUND', 404)), 'info');
  assert.equal(authLogSeverity(apiError('STEAM_PROFILE_PRIVATE', 400)), 'warning');
  assert.equal(authLogSeverity(apiError('WEIRD_CODE', 500)), 'error');
});

test('stripLeadingStatusEmoji removes the status prefix only', () => {
  assert.equal(stripLeadingStatusEmoji('⚠️ Hello there'), 'Hello there');
  assert.equal(stripLeadingStatusEmoji('No emoji here'), 'No emoji here');
});
