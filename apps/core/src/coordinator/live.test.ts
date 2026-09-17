import { type ServerMessage, serverMessage } from '@crazy/shared'
import { env, runInDurableObject } from 'cloudflare:test'
import { expect, it } from 'vite-plus/test'
import { REPLAY_BUFFER } from './patches'

const coordinatorFor = (userId: string) => env.COORDINATOR.get(env.COORDINATOR.idFromName(userId))

async function todoId(userId: string, title: string): Promise<string> {
  const row = await env.DB.prepare('SELECT id FROM todo WHERE userId = ? AND title = ?')
    .bind(userId, title)
    .first<{ id: string }>()
  return row!.id
}

/** Opens a socket to the user's Coordinator, as the web app does once it knows who is asking. */
async function openSocket(userId: string, since?: number) {
  const url = `https://crazy.test/live${since === undefined ? '' : `?since=${since}`}`
  const response = await coordinatorFor(userId).fetch(url, { headers: { Upgrade: 'websocket' } })
  const socket = response.webSocket!
  const heard: ServerMessage[] = []
  let wake: (() => void) | undefined
  socket.addEventListener('message', (event) => {
    heard.push(serverMessage.parse(JSON.parse(event.data as string)))
    wake?.()
  })
  socket.accept()

  /** Waits until `count` messages have arrived, and returns them all. */
  async function hear(count: number): Promise<ServerMessage[]> {
    while (heard.length < count) await new Promise<void>((resolve) => (wake = resolve))
    return heard
  }
  return { socket, hear }
}

const complete = (userId: string, id: string) =>
  coordinatorFor(userId).command({ type: 'todo.complete', todoId: id })

it('greets a socket with where the sequence stands, and nothing from the SDK', async () => {
  await coordinatorFor('live_a').provision({ timeZone: 'America/Chicago' })
  const { hear } = await openSocket('live_a')

  expect(await hear(1)).toEqual([{ type: 'hello', seq: 0, wokeAt: expect.any(String) }])
})

it("broadcasts a committed command to the user's open sockets, stamped with its sequence number", async () => {
  await coordinatorFor('live_b').provision({ timeZone: 'America/Chicago' })
  const desk = await openSocket('live_b')
  const phone = await openSocket('live_b')
  const dentist = await todoId('live_b', 'Book dentist')

  await complete('live_b', dentist)

  for (const tab of [desk, phone]) {
    expect((await tab.hear(2))[1]).toEqual({
      type: 'patch',
      seq: 1,
      ops: [{ type: 'todo.set', id: dentist, set: { state: 'done', doneAt: expect.any(String) } }],
    })
  }
})

it("sends nothing to another user's sockets", async () => {
  await coordinatorFor('live_c').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('live_d').provision({ timeZone: 'America/Chicago' })
  const theirs = await openSocket('live_d')

  await complete('live_c', await todoId('live_c', 'Book dentist'))
  await complete('live_d', await todoId('live_d', 'Send movers deposit'))

  // The first thing they hear after hello is their own patch, seq 1: the other user's never came.
  expect((await theirs.hear(2)).map((message) => message.type)).toEqual(['hello', 'patch'])
})

it('replays what a reconnecting socket missed, in order, then says where things stand', async () => {
  await coordinatorFor('live_e').provision({ timeZone: 'America/Chicago' })
  for (const title of ['Book dentist', 'Send movers deposit', 'Prep 1:1 notes for Devon']) {
    await complete('live_e', await todoId('live_e', title))
  }

  const { hear } = await openSocket('live_e', 1)

  expect((await hear(3)).map((message) => [message.type, message.seq])).toEqual([
    ['patch', 2],
    ['patch', 3],
    ['hello', 3],
  ])
})

it('replays nothing to a socket that missed nothing', async () => {
  await coordinatorFor('live_f').provision({ timeZone: 'America/Chicago' })
  await complete('live_f', await todoId('live_f', 'Book dentist'))

  expect(await (await openSocket('live_f', 1)).hear(1)).toMatchObject([{ type: 'hello', seq: 1 }])
})

it('tells a socket further behind than the buffer reaches to read everything again', async () => {
  await coordinatorFor('live_g').provision({ timeZone: 'America/Chicago' })
  const dentist = await todoId('live_g', 'Book dentist')
  const committed = REPLAY_BUFFER + 5
  for (let count = 0; count < committed; count += 1) await complete('live_g', dentist)

  // Patch 1 has fallen out of the buffer; a socket that only applied up to 3 cannot be caught up.
  const behind = await openSocket('live_g', 3)
  expect((await behind.hear(2)).map((message) => [message.type, message.seq])).toEqual([
    ['refetch', committed],
    ['hello', committed],
  ])

  // One that is within the buffer still can.
  const close = await openSocket('live_g', committed - 2)
  expect((await close.hear(3)).map((message) => message.type)).toEqual(['patch', 'patch', 'hello'])
})

it('tells a socket that claims a sequence number never issued to read everything again', async () => {
  await coordinatorFor('live_h').provision({ timeZone: 'America/Chicago' })
  expect((await (await openSocket('live_h', 40)).hear(2))[0]).toEqual({ type: 'refetch', seq: 0 })
})

it('tells open sockets to read again when the user is reseeded', async () => {
  await coordinatorFor('live_i').provision({ timeZone: 'America/Chicago' })
  const { hear } = await openSocket('live_i')

  await coordinatorFor('live_i').reseed({ persona: 'ryan', now: '2025-09-17T13:41:00.000Z' })

  expect((await hear(2))[1]).toEqual({ type: 'refetch', seq: 0 })
})

it('accepts sockets so that they hibernate, and records what woke it and when', async () => {
  const coordinator = coordinatorFor('live_j')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  await openSocket('live_j')

  // A socket the runtime holds for a hibernating object is one it lists here.
  expect(await runInDurableObject(coordinator, (_, state) => state.getWebSockets().length)).toBe(1)

  const realtime = await coordinator.realtime({ since: '2000-01-01T00:00:00.000Z' })
  expect(realtime).toMatchObject({
    sockets: 1,
    seq: 0,
    wakesSince: 1,
    lastWake: { cause: 'request', at: expect.any(String) },
  })
  expect((await coordinator.realtime({ since: '2999-01-01T00:00:00.000Z' })).wakesSince).toBe(0)
})
