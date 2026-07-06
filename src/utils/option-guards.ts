import { GAME_CHOICES, MANUAL_REGISTER_PLATFORM_CHOICES } from '../config/constants.js';
import type { SupportedGame } from '../config/types.js';
import type { ManualRegistrationChoice } from '../api/types.js';

export function isSupportedGame(value: string): value is SupportedGame {
  return GAME_CHOICES.some((choice) => choice.value === value);
}

export function isManualRegistrationChoice(value: string): value is ManualRegistrationChoice {
  return MANUAL_REGISTER_PLATFORM_CHOICES.some((choice) => choice.value === value);
}
