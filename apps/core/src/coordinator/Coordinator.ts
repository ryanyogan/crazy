import { createDb, loadCommandState, persistOps } from '@crazy/db/write'
import {
  type CommandResult,
  type ServerMessage,
  type ProvisionInput,
  type ReseedInput,
  type UserSettings,
  command,
  decide,
  provisionInput,
  reseedInput,
} from '@crazy/shared'
import { type Clock, systemClock } from '../clock'
import { provisionUser, reseedUser } from '../provision'
import { PatchLog } from './patches'
import { CoordinatorHost, type Socket } from './sdk'
import { type Wake, type WakeCause, WakeLog } from './wakes'

/**
 * One per user, named by their Clerk user id. It holds no domain data: D1 is
 * the only source of truth (ADR 0002). Because a Durable Object is
 * single-threaded, handing every write for a user to their Coordinator
 * serialises them, which stands in for the transactions D1 lacks.
 *
 * It provisions, seeds, commits commands and tells the user's open sockets what
 * it committed. The sockets hibernate: an idle tab costs nothing, and each time
 * something does wake the Coordinator it notes when and why. The schedules
 * arrive with later tickets.
 */

/** What the Integrations screen's Realtime panel will show. */
export interface Realtime {
  sockets: number
  seq: number
  lastWake: Wake | null
  wakesSince: number
}

export class Coordinator extends CoordinatorHost<Env> {
  protected clock: Clock = systemClock
  private last: Promise<unknown> = Promise.resolve()
  private readonly patches = new PatchLog(this.ctx.storage.sql)
  private readonly wakes = new WakeLog(this.ctx.storage.sql)

  /** Every way in starts here: the SDK is started, and a wake is noted if this is one. */
  private async awake(cause: WakeCause): Promise<void> {
    await this.ready()
    this.wakes.note(cause, this.clock())
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
    return this.inTurn(() =>
      provisionUser(createDb(this.env.DB), this.name, provisionInput.parse(input), this.clock()),
    )
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
   * Development only: throws away everything the user has and lays a persona's
   * content over the moment given, which is how a screen is compared with its
   * frame at the time the frame shows. Nothing in a production build calls it.
   */
  async reseed(input: ReseedInput): Promise<void> {
    await this.awake('request')
    const { persona, now } = reseedInput.parse(input)
    await this.inTurn(() => reseedUser(createDb(this.env.DB), this.name, persona, new Date(now)))
    // No patch can say "everything changed": open tabs read again.
    this.toEverySocket(this.say({ type: 'refetch', seq: this.patches.last() }))
  }
}
