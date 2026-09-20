import { createDb, deleteUser, loadCommandState, persistOps } from '@crazy/db/write'
import {
  type CommandResult,
  type ServerMessage,
  type ProvisionInput,
  type Realtime,
  type ReseedInput,
  type UserSettings,
  command,
  decide,
  addDays,
  provisionInput,
  reseedInput,
  startOfDay,
  wallClock,
} from '@crazy/shared'
import { type Clock, systemClock } from '../clock'
import { provisionUser, reseedUser } from '../provision'
import { PatchLog } from './patches'
import { CoordinatorHost, type Socket } from './sdk'
import { type WakeCause, WakeLog } from './wakes'

/**
 * One per user, named by their Clerk user id. It holds no domain data: D1 is
 * the only source of truth (ADR 0002). Because a Durable Object is
 * single-threaded, handing every write for a user to their Coordinator
 * serialises them, which stands in for the transactions D1 lacks.
 *
 * It provisions, seeds, commits commands and tells the user's open sockets what
 * it committed. The sockets hibernate: an idle tab costs nothing, and each time
 * something does wake the Coordinator it notes when and why. Its one schedule
 * so far is the Rollover, at the user's next local midnight.
 */

export class Coordinator extends CoordinatorHost<Env> {
  protected clock: Clock = systemClock
  private last: Promise<unknown> = Promise.resolve()
  private readonly patches = new PatchLog(this.ctx.storage.sql)
  private readonly wakes = new WakeLog(this.ctx.storage.sql)

  private rolloverChecked = false

  /** Every way in starts here: the SDK is started, and a wake is noted if this is one. */
  private async awake(cause: WakeCause): Promise<void> {
    await this.ready()
    this.wakes.note(cause, this.clock())
    // Once in an instance's life: a user from before there was a Rollover has none waiting.
    if (!this.rolloverChecked) {
      this.rolloverChecked = true
      if ((await this.dueAt('rollover')) === null) await this.scheduleRollover()
    }
  }

  /**
   * The Rollover waits for the user's next local midnight, by their time zone as
   * D1 has it now. A user with no settings yet has no midnight: provisioning
   * them is what schedules their first.
   */
  private async scheduleRollover(): Promise<void> {
    const settings = await createDb(this.env.DB).userSettings.findUnique({
      where: { userId: this.name },
      select: { timeZone: true },
    })
    if (!settings) return
    const { day } = wallClock(this.clock(), settings.timeZone)
    await this.callOnceAt(startOfDay(addDays(day, 1), settings.timeZone), 'rollover')
  }

  /** When the Rollover is next due. */
  async rolloverDueAt(): Promise<string | null> {
    await this.awake('request')
    return (await this.dueAt('rollover'))?.toISOString() ?? null
  }

  /**
   * Called by the schedule at the user's local midnight. The Rollover is a
   * command like any change, so its patch reaches open tabs the way any does;
   * then the next midnight is waited for. A midnight that failed is not retried
   * at once: the next wake finds nothing waiting and schedules again.
   */
  async rollover(): Promise<void> {
    await this.awake('schedule')
    try {
      await this.command({ type: 'rollover' })
    } finally {
      await this.scheduleRollover()
    }
  }

  private say(message: ServerMessage): string {
    return JSON.stringify(message)
  }

  /**
   * One write at a time. A Durable Object is single-threaded but lets another
   * call in whenever one awaits D1, so writes queue here to keep their order.
   */
  private inTurn<T>(write: () => Promise<T>): Promise<T> {
    const turn = this.last.then(write, write)
    this.last = turn.catch(() => {})
    return turn
  }

  /** Called on a user's first authenticated request, and harmlessly on any other. */
  async provision(input: ProvisionInput): Promise<UserSettings> {
    await this.awake('request')
    // The user is the one this Coordinator is named for, never an argument.
    const settings = await this.inTurn(() =>
      provisionUser(createDb(this.env.DB), this.name, provisionInput.parse(input), this.clock()),
    )
    if ((await this.dueAt('rollover')) === null) await this.scheduleRollover()
    return settings
  }

  /**
   * The single write path. Load what the command names, decide, persist to D1,
   * stamp the next sequence number, answer with the patch. Commands for one
   * user are taken one at a time, so each is decided against what the last one
   * left. A refusal is an answer; only a failure to write throws.
   */
  async command(input: unknown): Promise<CommandResult> {
    await this.awake('command')
    const parsed = command.parse(input)
    return this.inTurn(async () => {
      const db = createDb(this.env.DB)
      // One moment for the whole command: what is loaded and what is decided are of it.
      const now = this.clock()
      const decision = decide(await loadCommandState(db, this.name, parsed, now), parsed, now)
      if (!decision.ok) return decision
      await persistOps(db, this.name, decision.ops)
      const patch = this.patches.append(decision.ops)
      // To every socket, the sender's included: a client ignores a sequence number it has applied.
      this.toEverySocket(this.say({ type: 'patch', ...patch }))
      // Midnight has moved with the time zone, and the Rollover moves with it.
      if (parsed.type === 'settings.set' && parsed.set.timeZone !== undefined) {
        await this.scheduleRollover()
      }
      return { ok: true, patch }
    })
  }

  /**
   * The sequence number of the last patch committed. A loader reads it before
   * it reads D1, so the socket it then opens is replayed everything the read
   * might have missed; operations set values, so one applied twice is harmless.
   */
  async lastSeq(): Promise<number> {
    await this.awake('request')
    return this.patches.last()
  }

  async realtime(input: { since: string }): Promise<Realtime> {
    await this.awake('request')
    return {
      sockets: this.socketCount(),
      seq: this.patches.last(),
      lastWake: this.wakes.last(),
      wakesSince: this.wakes.countSince(new Date(input.since)),
    }
  }

  /**
   * A socket opens saying the last sequence number it applied (`?since=`). It
   * is replayed what it missed, or told to read everything again when the
   * buffer no longer reaches that far back, and then told where things stand.
   */
  protected socketOpened(socket: Socket, url: URL): void {
    this.wakes.note('socket', this.clock())
    const since = Number(url.searchParams.get('since') ?? Number.NaN)
    const seq = this.patches.last()
    const missed = Number.isInteger(since) ? this.patches.since(since) : []

    if (missed === 'gap') {
      socket.send(this.say({ type: 'refetch', seq }))
    } else {
      for (const patch of missed) socket.send(this.say({ type: 'patch', ...patch }))
    }
    socket.send(this.say({ type: 'hello', seq, wokeAt: this.wakes.last()?.at ?? null }))
  }

  /** Clients have nothing to say over the socket: commands arrive through the web app. */
  protected socketSpoke(): void {
    this.wakes.note('message', this.clock())
  }

  protected socketClosed(): void {
    this.wakes.note('close', this.clock())
  }

  /**
   * Clerk says this account is gone. Clerk owns the account (ADR 0001), so this
   * is the only thing that ever deletes a user, and it arrives as the
   * `user.deleted` webhook and nowhere else.
   *
   * Every row of theirs goes, in one order, through the one write path; then
   * nothing of theirs is left waiting to fire, their open tabs are told, and
   * this Coordinator forgets everything it held about them. It answers how many
   * rows there were.
   *
   * Their files in R2 are not deleted here: the Coordinator never touches a
   * bucket (ADR 0002). The Worker that holds it empties `users/<userId>/` once
   * this has returned.
   *
   * Asking twice is not an error — the second time there is nothing to delete
   * and it answers 0 — because a webhook is redelivered until it is answered.
   */
  async forget(): Promise<number> {
    await this.ready()
    // Not `awake`: a wake is a note about a user, and this user is about to
    // have none. Noting one would only be deleted a line later.
    const rows = await this.inTurn(() => deleteUser(createDb(this.env.DB), this.name))

    // Before the storage goes, and through the SDK, so the alarm behind the
    // schedules goes with them: a deleted user's Rollover must never fire.
    await this.cancelEverySchedule()
    this.closeEverySocket('This account is gone.')
    await this.forgetStorage()
    this.patches.empty()
    this.wakes.empty()
    // An instance that has forgotten is one that never was: were this name ever
    // used again, its first request would provision it from nothing.
    this.rolloverChecked = false
    return rows
  }

  /**
   * Development only: throws away everything the user has and lays a persona's
   * content over the moment given, which is how a screen is compared with its
   * frame at the time the frame shows. Nothing in a production build calls it.
   */
  async reseed(input: ReseedInput): Promise<void> {
    await this.awake('request')
    const { persona, now, timer } = reseedInput.parse(input)
    await this.inTurn(() =>
      reseedUser(createDb(this.env.DB), this.name, persona, new Date(now), timer),
    )
    // No patch can say "everything changed": open tabs read again.
    this.toEverySocket(this.say({ type: 'refetch', seq: this.patches.last() }))
  }
}
