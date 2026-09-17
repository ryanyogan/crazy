import type { Coordinator } from '@crazy/core'
import { env } from 'cloudflare:workers'

// Server only. The user's Coordinator lives in the core Worker; this Worker
// reaches it through a cross-Worker Durable Object binding. Every write goes
// through here, because the web app never writes to D1 itself (ADR 0002).

export function coordinatorFor(userId: string): DurableObjectStub<Coordinator> {
  const namespace = env.COORDINATOR as DurableObjectNamespace<Coordinator>
  return namespace.get(namespace.idFromName(userId))
}
