import { env, runInDurableObject } from 'cloudflare:test'
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

const signalRow = (userId: string, person: string) =>
  env.DB.prepare(
    'SELECT id, todoId, connectionId, sourceItemId FROM signal WHERE userId = ? AND person = ?',
  )
    .bind(userId, person)
    .first<{ id: string; todoId: string | null; connectionId: string; sourceItemId: string }>()

const todoById = (id: string) =>
  env.DB.prepare(
    'SELECT userId, title, state, sourceConnectionId, sourceKind, sourceItemId, touchedAt, snoozedUntil FROM todo WHERE id = ?',
  )
    .bind(id)
    .first<{
      userId: string
      title: string
      state: string
      sourceConnectionId: string | null
      sourceKind: string | null
      sourceItemId: string | null
      touchedAt: string
      snoozedUntil: string | null
    }>()

it('adds a typed-in Todo to D1 as a One-off of the user asking', async () => {
  const coordinator = coordinatorFor('user_m')
  await coordinator.provision({ timeZone: 'America/Chicago' })

  const result = await coordinator.command({
    type: 'todo.add',
    id: 'todo_m_1',
    title: 'Book dentist',
  })

  expect(result).toMatchObject({
    ok: true,
    patch: { seq: 1, ops: [{ type: 'todo.insert', todo: { id: 'todo_m_1', state: 'today' } }] },
  })
  expect(await todoById('todo_m_1')).toMatchObject({
    userId: 'user_m',
    title: 'Book dentist',
    state: 'today',
    sourceConnectionId: null,
    sourceKind: null,
  })
  expect(await todayTitles('user_m')).toHaveLength(8)
})

it("cannot add a Todo under the id of another user's Todo", async () => {
  await coordinatorFor('user_n').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('user_o').provision({ timeZone: 'America/Chicago' })
  const theirs = (await todoRow('user_o', 'Book dentist'))!

  // The write fails rather than landing on their row; the browser rolls back and says so.
  // Catch inside workerd: letting a rejected RPC escape also reports it as an
  // unhandled runtime error, even though the caller expects the rejection.
  const refused = await runInDurableObject(coordinatorFor('user_n'), async (instance) => {
    try {
      await instance.command({ type: 'todo.add', id: theirs.id, title: 'Mine now' })
      return false
    } catch {
      return true
    }
  })
  expect(refused).toBe(true)
  expect(await todoById(theirs.id)).toMatchObject({ userId: 'user_o', title: 'Book dentist' })
  expect(await todayTitles('user_n')).toHaveLength(7)
})

it('snoozes a Todo: it is touched now and out of the stack until the snooze ends', async () => {
  const coordinator = coordinatorFor('user_p')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_p', 'Book dentist'))!
  // The Coordinator reads the real clock, and the persona is seeded around it, so when it was
  // last touched is said here rather than taken from the seed: a long-untouched Todo, at any
  // hour the suite happens to run.
  const untouchedSince = '2025-09-16T16:00:00.000Z'
  await env.DB.prepare('UPDATE todo SET touchedAt = ? WHERE id = ?')
    .bind(untouchedSince, dentist.id)
    .run()
  const sent = Date.now()

  const result = await coordinator.command({ type: 'todo.snooze', todoId: dentist.id, minutes: 30 })

  expect(result).toMatchObject({
    ok: true,
    patch: { seq: 1, ops: [{ type: 'todo.set', id: dentist.id }] },
  })
  const after = (await todoById(dentist.id))!
  expect(after.state).toBe('today')
  expect(after.snoozedUntil).not.toBeNull()
  expect(new Date(after.snoozedUntil!).getTime() - new Date(after.touchedAt).getTime()).toBe(
    30 * 60_000,
  )
  // Touched at the moment the command was taken, not when it was last touched before.
  expect(new Date(after.touchedAt).getTime()).toBeGreaterThan(new Date(untouchedSince).getTime())
  expect(new Date(after.touchedAt).getTime()).toBeGreaterThanOrEqual(sent)
})

it('adds a Mention as a Todo with its Source, marks the Mention as added, and adds it once', async () => {
  const coordinator = coordinatorFor('user_q')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const devon = (await signalRow('user_q', 'Devon'))!
  expect(devon.todoId).toBeNull()

  const first = await coordinator.command({
    type: 'signal.add',
    signalId: devon.id,
    todoId: 'todo_q_1',
  })
  const again = await coordinator.command({
    type: 'signal.add',
    signalId: devon.id,
    todoId: 'todo_q_2',
  })

  expect(first).toMatchObject({
    ok: true,
    patch: {
      seq: 1,
      ops: [
        { type: 'todo.insert', todo: { id: 'todo_q_1', source: { kind: 'notion_page' } } },
        { type: 'signal.set', id: devon.id, set: { todoId: 'todo_q_1' } },
      ],
    },
  })
  expect(again).toMatchObject({ ok: true, patch: { seq: 2, ops: [] } })
  expect(await todoById('todo_q_1')).toMatchObject({
    userId: 'user_q',
    title: 'Reply to Devon: commented on your section of Q4 Priorities',
    state: 'today',
    sourceConnectionId: devon.connectionId,
    sourceKind: 'notion_page',
    sourceItemId: devon.sourceItemId,
  })
  expect(await todoById('todo_q_2')).toBeNull()
  expect((await signalRow('user_q', 'Devon'))?.todoId).toBe('todo_q_1')
})

it('creates nothing new for a Mention whose Source already has an open Todo, and marks it as that one', async () => {
  const coordinator = coordinatorFor('user_r')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  // Priya's message is the Source of a Todo in the stack; forget that it was added.
  const priya = (await signalRow('user_r', 'Priya'))!
  await env.DB.prepare('UPDATE signal SET todoId = NULL WHERE id = ?').bind(priya.id).run()
  const reply = (await todoRow('user_r', 'Reply to Priya on edge rate limits'))!

  const result = await coordinator.command({
    type: 'signal.add',
    signalId: priya.id,
    todoId: 'todo_r_1',
  })

  expect(result).toMatchObject({
    ok: true,
    patch: { seq: 1, ops: [{ type: 'signal.set', id: priya.id, set: { todoId: reply.id } }] },
  })
  expect(await todoById('todo_r_1')).toBeNull()
  expect((await signalRow('user_r', 'Priya'))?.todoId).toBe(reply.id)
  expect(await todayTitles('user_r')).toHaveLength(7)
})

it("brings a Mention's Todo into the day when its Source's only open Todo is in the backlog", async () => {
  const coordinator = coordinatorFor('user_u')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  // Priya's message is the Source of a Todo; forget that it was added, and leave that
  // Todo waiting in the backlog. When it was last touched is said here rather than taken
  // from the seed, which is laid over the real clock the Coordinator reads.
  const priya = (await signalRow('user_u', 'Priya'))!
  await env.DB.prepare('UPDATE signal SET todoId = NULL WHERE id = ?').bind(priya.id).run()
  const reply = (await todoRow('user_u', 'Reply to Priya on edge rate limits'))!
  const untouchedSince = '2025-09-16T16:00:00.000Z'
  await env.DB.prepare("UPDATE todo SET state = 'backlog', touchedAt = ? WHERE id = ?")
    .bind(untouchedSince, reply.id)
    .run()
  expect(await todayTitles('user_u')).toHaveLength(6)

  const result = await coordinator.command({
    type: 'signal.add',
    signalId: priya.id,
    todoId: 'todo_u_1',
  })

  expect(result).toMatchObject({
    ok: true,
    patch: {
      seq: 1,
      ops: [
        { type: 'todo.set', id: reply.id, set: { state: 'today' } },
        { type: 'signal.set', id: priya.id, set: { todoId: reply.id } },
      ],
    },
  })
  const after = (await todoById(reply.id))!
  expect(after.state).toBe('today')
  // Bringing it into the day is a touch; nothing new was made for it.
  expect(new Date(after.touchedAt).getTime()).toBeGreaterThan(new Date(untouchedSince).getTime())
  expect(await todoById('todo_u_1')).toBeNull()
  expect((await signalRow('user_u', 'Priya'))?.todoId).toBe(reply.id)
  expect(await todayTitles('user_u')).toHaveLength(7)
})

const slotsOf = async (todoId: string) =>
  (
    await env.DB.prepare('SELECT day, hour FROM slot WHERE todoId = ? ORDER BY hour')
      .bind(todoId)
      .all<{ day: string; hour: number }>()
  ).results

const wordedHours = async (userId: string) =>
  (
    await env.DB.prepare('SELECT hour FROM timeline_hour WHERE userId = ? ORDER BY hour')
      .bind(userId)
      .all<{ hour: number }>()
  ).results.map((row) => row.hour)

it('gives a Todo a Slot on the day the user is in, and touches it', async () => {
  const coordinator = coordinatorFor('user_v')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_v', 'Book dentist'))!
  const untouchedSince = '2025-09-16T16:00:00.000Z'
  await env.DB.prepare('UPDATE todo SET touchedAt = ? WHERE id = ?')
    .bind(untouchedSince, dentist.id)
    .run()

  const result = await coordinator.command({ type: 'todo.slot', todoId: dentist.id, hour: 8 })

  expect(result).toMatchObject({
    ok: true,
    patch: {
      seq: 1,
      ops: [
        { type: 'slot.set', todoId: dentist.id, hours: [8], day: expect.any(String) },
        { type: 'todo.set', id: dentist.id, set: { touchedAt: expect.any(String) } },
      ],
    },
  })
  // The Coordinator reads its own clock, so which day it is is its answer to
  // give: the row it wrote and the patch it sent say the same day and hour.
  const slotted = result.ok && result.patch.ops[0]
  expect(await slotsOf(dentist.id)).toEqual([
    { day: slotted && slotted.type === 'slot.set' ? slotted.day : null, hour: 8 },
  ])
  // Slotting is a touch, and no wording of the day was deleted along the way.
  const after = (await todoById(dentist.id))!
  expect(new Date(after.touchedAt).getTime()).toBeGreaterThan(new Date(untouchedSince).getTime())
  expect(await wordedHours('user_v')).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
})

it('refuses the hour a meeting fills, writes nothing and spends no sequence number', async () => {
  const coordinator = coordinatorFor('user_w')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const dentist = (await todoRow('user_w', 'Book dentist'))!

  // Frame 1a's design review has the whole of 14:00; the standup has half of 11:00.
  const refused = await coordinator.command({ type: 'todo.slot', todoId: dentist.id, hour: 14 })

  expect(refused).toEqual({
    ok: false,
    reason: '14:00 is a meeting, and Crazy never moves a meeting.',
  })
  expect((await slotsOf(dentist.id)).map((slot) => slot.hour)).toEqual([12])
  expect(
    await coordinator.command({ type: 'todo.slot', todoId: dentist.id, hour: 11 }),
  ).toMatchObject({ ok: true, patch: { seq: 1 } })
})

it('takes a Todo off the day, and says so once however often it is asked', async () => {
  const coordinator = coordinatorFor('user_x')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const deposit = (await todoRow('user_x', 'Send movers deposit'))!

  const first = await coordinator.command({ type: 'todo.clearSlot', todoId: deposit.id })
  const again = await coordinator.command({ type: 'todo.clearSlot', todoId: deposit.id })

  const cleared = first.ok ? first.patch.ops[0] : undefined
  expect(cleared).toMatchObject({ type: 'slot.set', hours: [] })
  // Asked again it is already off the day, which is what was asked for.
  expect(again).toMatchObject({ ok: true, patch: { seq: 2, ops: [] } })
  // Off this day only: a carried Todo keeps the hour it held on the day it was carried from,
  // which the persona gives it once that day has passed.
  const day = cleared?.type === 'slot.set' ? cleared.day : undefined
  expect((await slotsOf(deposit.id)).filter((slot) => slot.day === day)).toEqual([])
})

it("cannot give another user's Todo a Slot", async () => {
  await coordinatorFor('user_y').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('user_z').provision({ timeZone: 'America/Chicago' })
  const theirs = (await todoRow('user_z', 'Book dentist'))!

  expect(
    await coordinatorFor('user_y').command({ type: 'todo.slot', todoId: theirs.id, hour: 8 }),
  ).toEqual({ ok: false, reason: 'That Todo no longer exists.' })
  expect((await slotsOf(theirs.id)).map((slot) => slot.hour)).toEqual([12])
})

const startedRow = (id: string) =>
  env.DB.prepare('SELECT startedAt, swappedOnDay, state, touchedAt FROM todo WHERE id = ?')
    .bind(id)
    .first<{
      startedAt: string | null
      swappedOnDay: string | null
      state: string
      touchedAt: string
    }>()

// The one thing about Start and Swap that lives here and not at the command
// seam: a moment and a day reaching their columns in D1 intact. The rules
// themselves are pinned in `packages/shared/src/command.test.ts`.
it('writes a start as a moment and a swap as a day, touching the Todo only for the start', async () => {
  const coordinator = coordinatorFor('user_aa')
  await coordinator.provision({ timeZone: 'America/Chicago' })
  const spike = (await todoRow('user_aa', 'Finish Cloudflare session-token spike'))!
  const dentist = (await todoRow('user_aa', 'Book dentist'))!
  const untouchedSince = '2025-09-16T16:00:00.000Z'
  await env.DB.prepare("UPDATE todo SET touchedAt = ? WHERE userId = 'user_aa'")
    .bind(untouchedSince)
    .run()

  await coordinator.command({ type: 'todo.start', todoId: spike.id })
  await coordinator.command({ type: 'todo.swap', todoId: dentist.id })

  const started = (await startedRow(spike.id))!
  expect(started.startedAt).not.toBeNull()
  expect(new Date(started.startedAt!).getTime()).toBeGreaterThan(0)
  // Starting is a touch, taken at the Coordinator's own moment.
  expect(new Date(started.touchedAt).getTime()).toBeGreaterThan(new Date(untouchedSince).getTime())

  const swapped = (await startedRow(dentist.id))!
  expect(swapped.swappedOnDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(swapped.state).toBe('today')
  // Declining is not touching: the Rollover must still be free to send it back.
  expect(new Date(swapped.touchedAt).getTime()).toBe(new Date(untouchedSince).getTime())
})

it("cannot add another user's Mention", async () => {
  await coordinatorFor('user_s').provision({ timeZone: 'America/Chicago' })
  await coordinatorFor('user_t').provision({ timeZone: 'America/Chicago' })
  const theirs = (await signalRow('user_t', 'Devon'))!

  expect(
    await coordinatorFor('user_s').command({
      type: 'signal.add',
      signalId: theirs.id,
      todoId: 'todo_s_1',
    }),
  ).toEqual({ ok: false, reason: 'That Signal no longer exists.' })
  expect((await signalRow('user_t', 'Devon'))?.todoId).toBeNull()
})

it("waits for the user's next local midnight, rolls the day over then, and waits for the next", async () => {
  const stub = coordinatorFor('user_rollover')
  let now = new Date('2025-09-17T15:00:00Z') // 10:00 in Chicago
  await runInDurableObject(stub, (instance) => {
    ;(instance as unknown as { clock: () => Date }).clock = () => now
  })
  await stub.provision({ timeZone: 'America/Chicago' })
  expect(await stub.rolloverDueAt()).toBe('2025-09-18T05:00:00.000Z')

  now = new Date('2025-09-18T05:00:01Z')
  await stub.rollover()

  const todos = (
    await env.DB.prepare(
      "SELECT state, carryCount, touchedAt, sentBackAt FROM todo WHERE userId = ? AND state IN ('today', 'backlog')",
    )
      .bind('user_rollover')
      .all<{ state: string; carryCount: number; touchedAt: string; sentBackAt: string | null }>()
  ).results
  const kept = todos.filter((todo) => todo.state === 'today')
  const sentBack = todos.filter((todo) => todo.sentBackAt?.startsWith('2025-09-18T05:00:01'))
  // The persona's morning: Todos slotted today are carried over, the ones last touched yesterday are sent back.
  expect(kept.length).toBeGreaterThan(0)
  expect(kept.every((todo) => todo.carryCount >= 1)).toBe(true)
  expect(sentBack.length).toBeGreaterThan(0)
  expect(sentBack.every((todo) => todo.state === 'backlog' && todo.carryCount === 0)).toBe(true)
  expect(await stub.rolloverDueAt()).toBe('2025-09-19T05:00:00.000Z')

  // Midnight moves with the time zone: London's next is 23:00 UTC the same day.
  await stub.command({ type: 'settings.set', set: { timeZone: 'Europe/London' } })
  expect(await stub.rolloverDueAt()).toBe('2025-09-18T23:00:00.000Z')
})
