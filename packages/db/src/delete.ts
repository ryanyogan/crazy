import type { Db } from './client'

// Removing a person from Crazy entirely: every row of theirs, in every table.
// Only the Coordinator may call this, as with every other write (ADR 0002), and
// only Clerk's `user.deleted` webhook asks it to. Nothing in the app deletes a
// user, because nothing in the app owns an account: Clerk does (ADR 0001).

/** What deleting one table's rows for one user does. Every query filters by `userId`. */
type Eraser = (db: Db, userId: string) => Promise<{ count: number }>

export interface UserTable {
  /** The table as D1 has it, so a test can check this list against the database itself. */
  readonly name: string
  readonly erase: Eraser
}

/**
 * Every table that carries a `userId`, children before the rows they point at.
 *
 * D1 has no interactive transactions, so this is a sequence of statements
 * rather than one act: a run that stops half way leaves a smaller version of
 * the same user, and running it again finishes the job. That is why the order
 * matters and why deleting is idempotent — a second delivery of the same
 * webhook deletes nothing and succeeds.
 *
 * `delete.test.ts` fails if a new table carrying a `userId` is not named here.
 */
export const USER_TABLES: readonly UserTable[] = [
  { name: 'invoice_line', erase: (db, userId) => db.invoiceLine.deleteMany({ where: { userId } }) },
  { name: 'invoice', erase: (db, userId) => db.invoice.deleteMany({ where: { userId } }) },
  { name: 'time_entry', erase: (db, userId) => db.timeEntry.deleteMany({ where: { userId } }) },
  {
    name: 'metric_snapshot',
    erase: (db, userId) => db.metricSnapshot.deleteMany({ where: { userId } }),
  },
  { name: 'signal', erase: (db, userId) => db.signal.deleteMany({ where: { userId } }) },
  {
    name: 'week_day_line',
    erase: (db, userId) => db.weekDayLine.deleteMany({ where: { userId } }),
  },
  {
    name: 'week_day_note',
    erase: (db, userId) => db.weekDayNote.deleteMany({ where: { userId } }),
  },
  { name: 'tie_in', erase: (db, userId) => db.tieIn.deleteMany({ where: { userId } }) },
  {
    name: 'timeline_hour',
    erase: (db, userId) => db.timelineHour.deleteMany({ where: { userId } }),
  },
  {
    name: 'calendar_event',
    erase: (db, userId) => db.calendarEvent.deleteMany({ where: { userId } }),
  },
  { name: 'slot', erase: (db, userId) => db.slot.deleteMany({ where: { userId } }) },
  { name: 'overlap_note', erase: (db, userId) => db.overlapNote.deleteMany({ where: { userId } }) },
  { name: 'circle_match', erase: (db, userId) => db.circleMatch.deleteMany({ where: { userId } }) },
  // Said outright rather than left to the Todo's cascade. The bytes in R2 are
  // not D1's to delete: the Worker that holds the bucket empties the user's
  // prefix once this has returned (docs/BRIEF.md, "Deleting an account").
  { name: 'attachment', erase: (db, userId) => db.attachment.deleteMany({ where: { userId } }) },
  { name: 'todo', erase: (db, userId) => db.todo.deleteMany({ where: { userId } }) },
  { name: 'project', erase: (db, userId) => db.project.deleteMany({ where: { userId } }) },
  { name: 'client', erase: (db, userId) => db.client.deleteMany({ where: { userId } }) },
  { name: 'circle', erase: (db, userId) => db.circle.deleteMany({ where: { userId } }) },
  // A Connection is bookkeeping about a Clerk external account and holds no
  // token (ADR 0001), so there is nothing here to revoke: Clerk has already
  // taken the account away, which is why this webhook arrived.
  { name: 'connection', erase: (db, userId) => db.connection.deleteMany({ where: { userId } }) },
  { name: 'brief', erase: (db, userId) => db.brief.deleteMany({ where: { userId } }) },
  // Last: while it is there the user still exists, so a run that stopped half
  // way is a user whose settings say what time zone to finish the job in.
  {
    name: 'user_settings',
    erase: (db, userId) => db.userSettings.deleteMany({ where: { userId } }),
  },
]

/**
 * Deletes every row this user has and answers how many there were. Rows of
 * anyone else's are untouched: every statement filters by `userId`.
 */
export async function deleteUser(db: Db, userId: string): Promise<number> {
  let rows = 0
  for (const table of USER_TABLES) {
    rows += (await table.erase(db, userId)).count
  }
  return rows
}
