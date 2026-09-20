import { USER_TABLES } from '@crazy/db/write'
import { env } from 'cloudflare:test'
import { expect, it } from 'vite-plus/test'
import { aiGateway } from './ai'
import { providerPull } from './queue/provider-pull'

// The shells, inside workerd. There is almost nothing to assert, which is the
// point: each is bound, each runs, and none of them writes a row or reaches
// outside. The one thing worth holding on to is the last of those, so that a
// later change cannot quietly give one of them a second path into D1 (ADR
// 0002) — every write goes through the user's Coordinator as a command.

/** Every domain row there is, over the same list of tables that deleting a user walks. */
const rowsInD1 = async () => {
  let rows = 0
  for (const { name } of USER_TABLES) {
    const row = await env.DB.prepare(`SELECT count(*) AS rows FROM "${name}"`).first<{
      rows: number
    }>()
    rows += row?.rows ?? 0
  }
  return rows
}

/** A batch as the Queue would hand it over, remembering what was done to each message. */
function aBatch(bodies: unknown[]) {
  const acked: string[] = []
  const retried: string[] = []
  const messages = bodies.map((body, index) => ({
    id: `msg_${index}`,
    timestamp: new Date('2025-09-17T13:41:00.000Z'),
    body,
    attempts: 1,
    ack: () => void acked.push(`msg_${index}`),
    retry: () => void retried.push(`msg_${index}`),
  }))
  const batch = {
    messages,
    queue: 'crazy-provider-pull',
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackAll: () => {},
    retryAll: () => {},
  } as unknown as MessageBatch<unknown>
  return { batch, acked, retried }
}

it('acks every message on the Provider-pull Queue and writes nothing', async () => {
  const before = await rowsInD1()
  const { batch, acked, retried } = aBatch([{ userId: 'user_a' }, { userId: 'user_b' }])

  await providerPull(batch)

  expect(acked).toEqual(['msg_0', 'msg_1'])
  expect(retried).toEqual([])
  expect(await rowsInD1()).toBe(before)
})

/** Waits for a Workflow instance to stop running, and says how it ended. */
async function finished(instance: WorkflowInstance): Promise<string> {
  for (let tries = 0; tries < 100; tries++) {
    const { status } = await instance.status()
    if (status !== 'queued' && status !== 'running') return status
    await scheduler.wait(50)
  }
  return 'still running'
}

it('runs the Brief, invoice and archive Workflows through and writes nothing', async () => {
  const before = await rowsInD1()

  // Started through their real bindings, so what is exercised is that each is
  // declared, bound and the class wrangler.jsonc names.
  const started = await Promise.all([
    env.BRIEF.create({ params: { userId: 'user_a', day: '2025-09-17' } }),
    env.INVOICE.create({
      params: {
        userId: 'user_a',
        clientId: 'client_a',
        fromDay: '2025-09-01',
        toDay: '2025-09-30',
      },
    }),
    env.ARCHIVE.create({ params: { userId: 'user_a', beforeDay: '2025-06-19' } }),
  ])

  expect(await Promise.all(started.map(finished))).toEqual(['complete', 'complete', 'complete'])
  expect(await rowsInD1()).toBe(before)
})

it('says so rather than calling a model when no AI Gateway is configured', () => {
  // The binding is there and deploys with no gateway in existence; the id is
  // the owner's to set (docs/BRIEF.md). Nothing calls this yet.
  expect(() => aiGateway(env as unknown as Env)).toThrow(/AI_GATEWAY_ID/)
})
