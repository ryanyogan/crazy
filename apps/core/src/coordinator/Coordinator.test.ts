import { env } from 'cloudflare:test'
import { expect, it } from 'vite-plus/test'

const coordinatorFor = (userId: string) => env.COORDINATOR.get(env.COORDINATOR.idFromName(userId))

const settingsRows = async (userId: string) =>
  (await env.DB.prepare('SELECT * FROM user_settings WHERE userId = ?').bind(userId).all()).results

it("creates a user's settings on their first request, in the time zone they arrived from", async () => {
  const settings = await coordinatorFor('user_a').provision({ timeZone: 'America/Chicago' })

  expect(settings).toEqual({
    userId: 'user_a',
    timeZone: 'America/Chicago',
    briefTime: '06:00',
    sentBackDays: 1,
    archiveDays: 90,
    billing: false,
  })
  expect(await settingsRows('user_a')).toHaveLength(1)
})

it('does not duplicate or overwrite settings when the user arrives again', async () => {
  await coordinatorFor('user_b').provision({ timeZone: 'Europe/London' })
  const again = await coordinatorFor('user_b').provision({ timeZone: 'Asia/Tokyo' })

  expect(again.timeZone).toBe('Europe/London')
  expect(await settingsRows('user_b')).toHaveLength(1)
})

it('falls back to UTC when the time zone is unknown', async () => {
  const settings = await coordinatorFor('user_c').provision({ timeZone: 'Mars/Olympus' })
  expect(settings.timeZone).toBe('UTC')
})

const todayTitles = async (userId: string) =>
  (
    await env.DB.prepare(
      "SELECT title FROM todo WHERE userId = ? AND state = 'today' ORDER BY stackPosition",
    )
      .bind(userId)
      .all<{ title: string }>()
  ).results.map((row) => row.title)

it('gives a new user the Ryan persona to start from, once', async () => {
  await coordinatorFor('user_d').provision({ timeZone: 'America/Chicago' })
  expect(await todayTitles('user_d')).toHaveLength(7)

  await env.DB.prepare("UPDATE todo SET state = 'done' WHERE userId = ? AND stackPosition = 1")
    .bind('user_d')
    .run()
  await coordinatorFor('user_d').provision({ timeZone: 'America/Chicago' })
  expect(await todayTitles('user_d')).toHaveLength(6)
})

it("lays the persona over a given moment when asked to reseed, leaving other users' rows alone", async () => {
  await coordinatorFor('user_e').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('user_f').provision({ timeZone: 'America/Chicago' })
  await env.DB.prepare("UPDATE todo SET state = 'done' WHERE userId IN ('user_e', 'user_f')").run()

  await coordinatorFor('user_e').reseed({ persona: 'ryan', now: '2025-09-17T13:41:00.000Z' })

  expect(await todayTitles('user_e')).toHaveLength(7)
  expect(await todayTitles('user_f')).toHaveLength(0)
  const { day } = (await env.DB.prepare("SELECT day FROM brief WHERE userId = 'user_e'").first<{
    day: string
  }>())!
  expect(day).toBe('2025-09-17')
})

it('provisions a user once when two of their first requests arrive together', async () => {
  const [one, other] = await Promise.all([
    coordinatorFor('user_g').provision({ timeZone: 'America/Chicago' }),
    coordinatorFor('user_g').provision({ timeZone: 'America/Chicago' }),
  ])

  expect(one).toEqual(other)
  expect(await settingsRows('user_g')).toHaveLength(1)
  expect(await todayTitles('user_g')).toHaveLength(7)
})

const todoRow = (userId: string, title: string) =>
  env.DB.prepare('SELECT id, state, doneAt FROM todo WHERE userId = ? AND title = ?')
    .bind(userId, title)
    .first<{ id: string; state: string; doneAt: string | null }>()

it('completes a Todo in D1 and answers with the patch, stamped with the next sequence number', async () => {
  const coordinator = coordinatorFor('user_h')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_h', 'Book dentist'))!
  const deposit = (await todoRow('user_h', 'Send movers deposit'))!

  const first = await coordinator.command({ type: 'todo.complete', todoId: dentist.id })
  const second = await coordinator.command({ type: 'todo.complete', todoId: deposit.id })

  expect(first).toMatchObject({
    ok: true,
    patch: { seq: 1, ops: [{ type: 'todo.set', id: dentist.id, set: { state: 'done' } }] },
  })
  expect(second).toMatchObject({ ok: true, patch: { seq: 2 } })
  expect(await todoRow('user_h', 'Book dentist')).toMatchObject({ state: 'done' })
  expect((await todoRow('user_h', 'Book dentist'))?.doneAt).not.toBeNull()
})

it('refuses a command it cannot carry out, writes nothing and spends no sequence number', async () => {
  const coordinator = coordinatorFor('user_i')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_i', 'Book dentist'))!
  await env.DB.prepare("UPDATE todo SET state = 'archived' WHERE id = ?").bind(dentist.id).run()

  expect(await coordinator.command({ type: 'todo.complete', todoId: dentist.id })).toEqual({
    ok: false,
    reason: 'An archived Todo cannot be completed.',
  })
  expect(await todoRow('user_i', 'Book dentist')).toMatchObject({ state: 'archived', doneAt: null })

  const deposit = (await todoRow('user_i', 'Send movers deposit'))!
  expect(await coordinator.command({ type: 'todo.complete', todoId: deposit.id })).toMatchObject({
    patch: { seq: 1 },
  })
})

it("cannot touch another user's Todo", async () => {
  await coordinatorFor('user_j').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('user_k').provision({ timeZone: 'America/Chicago' })
  const theirs = (await todoRow('user_k', 'Book dentist'))!

  expect(
    await coordinatorFor('user_j').command({ type: 'todo.complete', todoId: theirs.id }),
  ).toEqual({ ok: false, reason: 'That Todo no longer exists.' })
  expect(await todoRow('user_k', 'Book dentist')).toMatchObject({ state: 'today' })
})

it('applies two commands sent at once one after the other', async () => {
  const coordinator = coordinatorFor('user_l')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_l', 'Book dentist'))!

  // The same tick from two devices: the first completes it, the second finds it done.
  const results = await Promise.all([
    coordinator.command({ type: 'todo.complete', todoId: dentist.id }),
    coordinator.command({ type: 'todo.complete', todoId: dentist.id }),
  ])

  expect(results.map((result) => result.ok && result.patch.seq)).toEqual([1, 2])
  expect(results.map((result) => result.ok && result.patch.ops.length)).toEqual([1, 0])
})
