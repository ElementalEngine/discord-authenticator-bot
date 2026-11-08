import type { ButtonInteraction, ChatInputCommandInteraction, GuildMember } from 'discord.js';

import { api, type ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import type { Game, SessionState } from '../api/types.js';
import * as staffLog from '../services/staff-log.js';
import { waitOut } from '../ui/failure.js';
import { notice, type Panel } from '../ui/kit.js';
import * as panels from '../ui/panels.js';
import { show } from '../ui/reply.js';
import { log } from '../utils/log.js';
import { failed, settle } from './outcome.js';

const POLL_MS = 2500;
// Discord stops accepting edits to an answer 15 minutes after the command.
const ANSWER_LIFE_MS = 14 * 60_000;

type Started = ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>;

type Watch = {
  readonly interaction: Started;
  readonly member: GuildMember;
  readonly game: Game;
  readonly sessionId: string;
  readonly endsAt: number;
  timer?: NodeJS.Timeout;
  checking: boolean;
  // Set once core-api has been asked to register: from then on its answer decides.
  asked: boolean;
};

// Follows each player's Steam sign-in until it ends, one at a time a player.
// Watches live in memory: after a restart a player runs /register again.
class SessionWatch {
  private readonly watches = new Map<string, Watch>();
  // Registrations core-api was asked for, by session, until it answers.
  private readonly finishing = new Map<string, Promise<void>>();
  private stopping = false;

  constructor(private readonly api: ApiClient) {}

  async start(interaction: Started, member: GuildMember, game: Game): Promise<void> {
    const session = await this.api.startSession(member.id, game);
    if (this.stopping) return show(interaction, panels.restarting);
    const endsAt = Math.min(Date.parse(session.expires_at), interaction.createdTimestamp + ANSWER_LIFE_MS);
    const signIn = panels.signIn(game, session.authorize_url, session.session_id, endsAt);
    const older = this.watches.get(member.id);
    this.end(member.id);
    // Saved before any await, so a second start at the same moment replaces this one cleanly.
    const watch: Watch = { interaction, member, game, sessionId: session.session_id, endsAt, checking: false, asked: false };
    this.watches.set(member.id, watch);
    // A registration core-api was asked for and never answered is not dropped unseen.
    if (older?.asked) await this.unknown(older);
    else if (older) await show(older.interaction, notice('info', 'You started another sign-in. Use the newest message.'));
    if (!this.live(watch)) return;
    await show(interaction, signIn);
    if (this.live(watch)) this.next(watch);
  }

  // A Cancel stops only the sign-in its message shows, and never one core-api was
  // asked to register: then it answers false and the registration runs on.
  cancel(userId: string, sessionId: string): boolean {
    const watch = this.watches.get(userId);
    if (this.finishing.has(sessionId) || (watch?.sessionId === sessionId && watch.asked)) return false;
    if (watch?.sessionId === sessionId) this.end(userId);
    return true;
  }

  // Players still signing in are told to start again, a registration already
  // asked for is seen through, and staff hear of any whose outcome is unknown.
  async stopAll(): Promise<void> {
    this.stopping = true;
    const open = [...this.watches.values()];
    for (const watch of open) this.end(watch.member.id);
    await Promise.all([...this.finishing.values(), ...open.map((watch) => (watch.asked ? this.unknown(watch) : show(watch.interaction, panels.restarting)))]);
  }

  private end(userId: string): void {
    clearTimeout(this.watches.get(userId)?.timer);
    this.watches.delete(userId);
  }

  private unconfirmed(watch: Watch): staffLog.Entry {
    return staffLog.error(watch.member.id, 'confirm a Steam registration', 'core-api was asked to register them; check /lookup and their roles');
  }

  // core-api was asked to register them and never said whether it did.
  private async unknown(watch: Watch): Promise<void> {
    await staffLog.post(watch.interaction.client, [this.unconfirmed(watch)]);
    await show(watch.interaction, panels.unconfirmed);
  }

  private live(watch: Watch): boolean {
    return this.watches.get(watch.member.id) === watch;
  }

  private next(watch: Watch): void {
    watch.timer = setTimeout(() => void this.tick(watch), POLL_MS);
  }

  private async close(watch: Watch, panel: Panel): Promise<void> {
    if (!this.live(watch)) return;
    this.end(watch.member.id);
    await show(watch.interaction, panel);
  }

  private async expire(watch: Watch): Promise<void> {
    if (!watch.asked) return this.close(watch, panels.expired);
    this.end(watch.member.id);
    return this.unknown(watch);
  }

  private async tick(watch: Watch): Promise<void> {
    if (!this.live(watch)) return;
    if (Date.now() >= watch.endsAt) return this.expire(watch);
    let state: SessionState;
    try {
      state = await this.api.session(watch.sessionId);
    } catch (error) {
      if (!this.live(watch)) return;
      if (waitOut(error)) return this.next(watch);
      return this.close(watch, await this.failure(watch, error));
    }
    if (!this.live(watch)) return;
    switch (state.status) {
      case 'validating':
        if (!watch.checking) await show(watch.interaction, panels.checking(watch.game));
        watch.checking = true;
        // A cancel or a newer sign-in during that edit ended this watch.
        return this.live(watch) ? this.next(watch) : undefined;
      case 'validated':
      case 'completed':
        return this.complete(watch);
      case 'failed':
        return this.close(watch, await this.storedFailure(watch, state));
      case 'expired':
        return this.expire(watch);
      default:
        return this.next(watch);
    }
  }

  // Once asked, the watch leaves the map, so a cancel, a newer sign-in or a
  // shutdown cannot drop a registration core-api has made.
  private complete(watch: Watch): Promise<void> {
    clearTimeout(watch.timer);
    this.watches.delete(watch.member.id);
    watch.asked = true;
    const done = this.finish(watch).finally(() => this.finishing.delete(watch.sessionId));
    this.finishing.set(watch.sessionId, done);
    return done;
  }

  private async finish(watch: Watch): Promise<void> {
    const { interaction, member } = watch;
    try {
      const registration = await this.api.complete(watch.sessionId, member.id);
      const sync = await settle(interaction.guild, member, registration, 'steam');
      await show(interaction, panels.registered(registration, sync));
    } catch (error) {
      // An outage is waited out unless the bot is stopping or the player has moved
      // on: complete answers the same registration when asked again.
      if (waitOut(error) && !this.stopping && !this.watches.has(member.id)) {
        log.warn(`registration for ${member.id} not answered; asking again`, error instanceof Error ? error.message : error);
        this.watches.set(member.id, watch);
        return this.next(watch);
      }
      await show(interaction, await this.failure(watch, error));
    }
  }

  // After core-api was asked, no answer or a vanished session leaves the outcome unknown.
  private async failure(watch: Watch, error: unknown): Promise<Panel> {
    const unanswered = !(error instanceof ApiError) || waitOut(error) || error.code === 'REGISTRATION_SESSION_NOT_FOUND';
    if (watch.asked && unanswered) {
      await staffLog.post(watch.interaction.client, [this.unconfirmed(watch)]);
    }
    return failed(watch.interaction.guild, watch.member.id, error, 'finish a Steam registration');
  }

  // The checks run when the player signs in; a refusal is kept on the session.
  private async storedFailure(watch: Watch, state: SessionState): Promise<Panel> {
    const failure = state.failure;
    const ref = failure?.correlation_id ? ` (ref ${failure.correlation_id})` : '';
    if (!failure || failure.code === 'INTERNAL' || failure.code.endsWith('MISCONFIGURED')) {
      const detail = failure ? `${failure.code}${ref}` : 'no reason stored';
      await staffLog.post(watch.interaction.client, [staffLog.error(watch.member.id, 'check a Steam sign-in', detail)]);
      return notice('failed', `We couldn't check your sign-in. Staff have been told.${ref}`);
    }
    return notice('refused', `${failure.message}${ref}`);
  }
}

export const watch = new SessionWatch(api);
