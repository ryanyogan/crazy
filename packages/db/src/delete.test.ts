import { env } from 'cloudflare:test'
import { expect, it } from 'vite-plus/test'
import { USER_TABLES, deleteUser } from './delete'
import { seedPersona } from './seed'
import { createDb } from './write'

// Deleting a person from D1, against the real schema. The first test is the one
// that matters over time: it reads the database itself, so a table added later
// with a `userId` on it cannot be forgotten here without this failing.

/** Tables D1 and the migration runner keep for themselves, which belong to nobody. */
const NOT_OURS = (name: string) => name.startsWith('sqlite_') || name.startsWith('_cf_')

const tablesCarryingUserId = async (): Promise<string[]> => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all<{ name: string }>()

  const carrying: string[] = []
  for (const { name } of results) {
    if (NOT_OURS(name) || name === 'd1_migrations') continue
    const columns = await env.DB.prepare(`PRAGMA table_info("${name}")`).all<{ name: string }>()
    if (columns.results.some((column: { name: string }) => column.name === 'userId')) {
      carrying.push(name)
    }
  }
  return carrying
}

it('names every table that carries a userId, so a new one cannot be left behind', async () => {
  const named = [...USER_TABLES.map((table) => table.name)].sort()
  expect(named).toEqual(await tablesCarryingUserId())
})

it('leaves nothing of the user it deletes, and nothing of anyone else missing', async () => {
  const db = createDb(env.DB)
  const now = new Date('2025-09-17T13:41:00.000Z')
  await seedPersona(db, { persona: 'cori', userId: 'user_gone', now, timeZone: 'America/Chicago' })
  await seedPersona(db, { persona: 'cori', userId: 'user_stays', now, timeZone: 'America/Chicago' })
  // Settings are a user's one row that the persona seed does not lay down: it
  // is provisioning that makes a user, and it is what says they exist at all.
  for (const userId of ['user_gone', 'user_stays']) {
    await db.userSettings.create({ data: { userId, timeZone: 'America/Chicago', createdAt: now } })
  }

  const countsFor = async (userId: string) => {
    const counts: Record<string, number> = {}
    for (const { name } of USER_TABLES) {
      const row = await env.DB.prepare(`SELECT count(*) AS rows FROM "${name}" WHERE userId = ?`)
        .bind(userId)
        .first<{ rows: number }>()
      counts[name] = row?.rows ?? 0
    }
    return counts
  }

  const before = await countsFor('user_stays')
  // The persona fills most of them: a delete that "worked" on empty tables
  // would prove nothing.
  expect(Object.values(before).filter((rows) => rows > 0).length).toBeGreaterThan(10)

  const rows = await deleteUser(db, 'user_gone')

  expect(rows).toBeGreaterThan(0)
  expect(Object.values(await countsFor('user_gone'))).toEqual(USER_TABLES.map(() => 0))
  expect(await countsFor('user_stays')).toEqual(before)
})

it('deletes a user who has nothing, and a user who has already been deleted', async () => {
  const db = createDb(env.DB)
  expect(await deleteUser(db, 'user_who_never_was')).toBe(0)

  const now = new Date('2025-09-17T13:41:00.000Z')
  await seedPersona(db, { persona: 'ryan', userId: 'user_twice', now, timeZone: 'UTC' })
  expect(await deleteUser(db, 'user_twice')).toBeGreaterThan(0)
  expect(await deleteUser(db, 'user_twice')).toBe(0)
})
