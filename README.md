# Discord Authenticator Bot

Lean Discord auth bot for CivCPL. This bot owns Discord UX, policy checks, and role synchronization. The core API owns OAuth, persistence, Steam validation, and auth decisions.

## Commands

- `/register register game:<civ6|civ7>`
- `/register add-rank-role game:<civ6|civ7>`
- `/admin manual-register user:<member> game:<civ6|civ7> steam_id:<id> reason:<text>`
- `/admin lookup-discord user:<member> [discord_id:<id>]`
- `/admin lookup-steam steam_id:<id>`

## Backend contract

This bot expects the backend auth feature to expose:

- `POST /api/v1/auth/registration-sessions`
- `GET /api/v1/auth/registration-sessions/{sessionId}`
- `POST /api/v1/auth/registration-sessions/{sessionId}/complete`
- `POST /api/v1/auth/registration-operations/{operationId}/finalize`
- `POST /api/v1/auth/rank-role-requests`
- `POST /api/v1/auth/admin/manual-registrations`
- `GET /api/v1/auth/admin/accounts/discord/{discordId}`
- `GET /api/v1/auth/admin/accounts/steam/{steamId}`

## Scripts

- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run deploy`
- `npm run verify`


## Environment files

- `.env.development` for local/dev runs
- `.env.production` for production runs

The bot loads `.env.${NODE_ENV}`. When `NODE_ENV` is unset, it defaults to `development`, so local runs load `.env.development`.

## Scripts

- `npm run dev` -> run from source with `tsx watch` (no build)
- `npm run dev:deploy` -> deploy commands from source in development
- `npm run build` -> compile to `dist/`
- `npm run start` -> run the built bot from `dist/`
- `npm run deploy` -> run the built deploy script from `dist/`
- `npm run verify` -> typecheck + build + lint
