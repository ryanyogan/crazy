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

  /** Sends to every open socket. Waking to send does not keep the sockets from hibernating again. */
  protected toEverySocket(message: string): void {
    this.broadcast(message)
  }

  protected socketCount(): number {
    return [...this.getConnections()].length
  }
}
