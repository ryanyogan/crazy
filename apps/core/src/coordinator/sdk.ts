import { Agent, type Connection, type ConnectionContext, type WSMessage } from 'agents'

// The only module that imports Cloudflare's Agents SDK (ADR 0002; lint enforces
// it). The Coordinator uses the SDK for its named schedules, hibernating
// sockets (the SDK's default, so an idle open tab costs nothing) and Workflow
// bridge, and nothing else, so that it can be swapped for a raw Durable Object
// by rewriting this file.

/** One open socket, as the Coordinator sees it. */
export type Socket = Pick<Connection, 'id' | 'send' | 'close'>
export type SocketMessage = WSMessage

export abstract class CoordinatorHost<Env extends Cloudflare.Env> extends Agent<Env> {
  // The SDK would otherwise greet each socket with the instance's name, which is the user's id.
  static override options = { sendIdentityOnConnect: false }

  /**
   * Native RPC does not run the SDK's startup. Every public method of the
   * Coordinator awaits this first.
   */
  protected ready(): Promise<void> {
    return this.__unsafe_ensureInitialized()
  }

  /**
   * Banned. The SDK's state sync would make the Coordinator a second owner of
   * domain state; D1 is the only one. Clients receive `{seq, ops}` patches.
   */
  override setState(): never {
    throw new Error('setState is banned in the Coordinator (ADR 0002)')
  }

  /** No socket is sent the SDK's own frames (identity, state sync, MCP servers): only ours. */
  override shouldSendProtocolMessages(): boolean {
    return false
  }

  /** A socket has opened. `url` is the upgrade request's. */
  protected abstract socketOpened(socket: Socket, url: URL): void | Promise<void>
  protected abstract socketClosed(socket: Socket): void | Promise<void>
  protected abstract socketSpoke(socket: Socket, message: SocketMessage): void | Promise<void>

  override onConnect(connection: Connection, ctx: ConnectionContext) {
    return this.socketOpened(connection, new URL(ctx.request.url))
  }

  override onClose(connection: Connection) {
    return this.socketClosed(connection)
  }

  override onMessage(connection: Connection, message: WSMessage) {
    return this.socketSpoke(connection, message)
  }

  /**
   * One schedule per callback: whatever was waiting to call it is cancelled, and
   * it is called once, at `when`. The SDK keeps schedules in the instance's own
   * SQLite and wakes it with an alarm, so a sleeping Coordinator costs nothing.
   */
  protected async callOnceAt(when: Date, callback: keyof this & string): Promise<void> {
    for (const held of await this.listSchedules()) {
      if (held.callback === callback) await this.cancelSchedule(held.id)
    }
    await this.schedule(when, callback)
  }

  /**
   * Cancels everything waiting to be called. Through the SDK rather than the
   * alarm, because the SDK owns the alarm slot: a schedule left behind would
   * wake a Coordinator for a user who no longer exists.
   */
  protected async cancelEverySchedule(): Promise<void> {
    for (const held of await this.listSchedules()) await this.cancelSchedule(held.id)
  }

  /** When `callback` is next due to be called, or null when nothing is waiting to call it. */
  protected async dueAt(callback: keyof this & string): Promise<Date | null> {
    const times = (await this.listSchedules())
      .filter((held) => held.callback === callback)
      .map((held) => held.time)
    return times.length === 0 ? null : new Date(Math.min(...times) * 1000)
  }

  /** Sends to every open socket. Waking to send does not keep the sockets from hibernating again. */
  protected toEverySocket(message: string): void {
    this.broadcast(message)
  }

  protected socketCount(): number {
    return [...this.getConnections()].length
  }

  /** Closes every open socket, with a reason the client can show. */
  protected closeEverySocket(reason: string): void {
    // 1000 is a normal close: there is nothing wrong, there is simply no more
    // to say, so a client is not to reconnect and try again.
    for (const socket of this.getConnections()) socket.close(1000, reason)
  }

  /**
   * Empties this instance's own storage: every row in its SQLite, whichever
   * table holds it — ours and the SDK's — every key on the key-value side, and
   * the alarm behind them.
   *
   * It *empties* rather than drops, which is why neither
   * `ctx.storage.deleteAll()` nor the SDK's `destroy()` is used here. Both drop
   * the tables: `deleteAll` takes the SDK's own tables with it and leaves this
   * instance unable to answer another call (`no such table: cf_agents_jobs`),
   * and `destroy` goes further and aborts the isolate, which would take with it
   * the very call that asked. Account deletion arrives as a webhook that is
   * redelivered until it is answered, so the one thing it must not do is fail
   * to answer. Emptying leaves exactly the same nothing behind, and leaves the
   * instance able to speak.
   */
  protected async forgetStorage(): Promise<void> {
    const { sql } = this.ctx.storage
    // Everything but the runtime's own: `sqlite_*` is SQLite's catalogue and
    // `_cf_*` is where the key-value side is kept, which is emptied below
    // through its own API rather than behind its back.
    const tables = sql
      .exec<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table'
           AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
           AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'`,
      )
      .toArray()
    for (const { name } of tables) sql.exec(`DELETE FROM "${name}"`)

    const keys = await this.ctx.storage.list()
    if (keys.size > 0) await this.ctx.storage.delete([...keys.keys()])
    await this.ctx.storage.deleteAlarm()
  }
}
