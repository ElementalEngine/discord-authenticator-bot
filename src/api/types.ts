import type { components } from './contract.js';

type Schemas = components['schemas'];

export type Game = Schemas['SupportedGame'];
export type RoleIntent = Schemas['RoleIntent'];
export type ManualPlatform = Schemas['ManualRegistrationChoice'];
export type SessionStarted = Schemas['SessionStarted'];
export type SessionState = Schemas['SessionState'];
export type Registration = Schemas['Registration'];
export type ManualRegistration = Schemas['ManualRegistrationBody'];
export type TwoKRegistration = Schemas['TwoKRegistrationBody'];
export type AccountLookup = Schemas['AccountLookup'];
export type AccountRecord = Schemas['AccountRecord'];
export type Standing = Schemas['Standing'];
export type ErrorDetail = Schemas['ErrorDetail'];
