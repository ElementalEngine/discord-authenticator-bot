# Auth bot

Registers CPL players. A player proves they own Civilization on Steam by
signing in with Discord, or registers a 2K account for Civilization VII; staff
can register a player by hand and look up who holds an account. core-api does
the checks and keeps the records; this bot is the Discord side and sets roles.

## Commands

| Command | Who | Where |
|---|---|---|
| `/register civ6`, `/register civ7` | members not yet verified | the welcome channel |
| `/register add-rank-role game:` | registered players | the civ6 or civ7 commands channel |
| `/lookup type: value:` | staff | the bot-commands channel |
| `/manual-register` | staff | the bot-commands channel |

Access is one table, `src/config/access.ts`. Every answer is private.

## Staff log

One channel, `CHANNEL_AUTHBOT_LOG_ID`, one plain-text line per event, tagged
first so it can be searched: `[REGISTERED]`, `[CLASH]`, `[YOUNG-ACCOUNT]`,
`[ERROR]`. The moderator role is mentioned only when a clash names an account
that is banned from the server, suspended, or at the ban threshold. Reading
server bans needs the bot to hold **Ban Members**.

## core-api

The bot calls `/api/v2/auth/*` on its own service token. The types in
`src/api/contract.ts` are generated from `contracts/openapi.json`, core-api's
spec, vendored with `npm run vendor:contracts` (see `contracts/PROVENANCE`).

## Scripts

- `npm run dev`: run from source
- `npm run build`, `npm start`: build to `dist/` and run it
- `npm run verify`: typecheck, lint, tests, version pins, build, contracts

Commands are set on Discord each time the bot starts.
