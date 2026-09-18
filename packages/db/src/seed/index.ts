import type { Persona } from '@crazy/shared'
import type { Db } from '../client'
import { ryan } from './ryan'

// The persona seed: the mockups' sample content, stored exactly where real and
// generated data will live, so the screens do not change when those arrive.
// It writes, so only the Coordinator may run it (ADR 0002).

export interface SeedInput {
  persona: Persona
  userId: string
  /** The moment the mockups' "now" is laid over: their Wednesday 08:41 becomes this day. */
  now: Date
  timeZone: string
}

const PERSONA_SEEDS = { ryan } satisfies Record<Persona, unknown>

/**
 * Replaces everything the user has with the persona's content. D1 has no
 * transactions: rows go child-first out and parent-first in, so a run that
 * stops half way is put right by running it again.
 */
export async function seedPersona(db: Db, input: SeedInput): Promise<void> {
  const { userId } = input
  const rows = PERSONA_SEEDS[input.persona](input)

  await db.signal.deleteMany({ where: { userId } })
  await db.timelineHour.deleteMany({ where: { userId } })
  await db.calendarEvent.deleteMany({ where: { userId } })
  await db.slot.deleteMany({ where: { userId } })
  await db.overlapNote.deleteMany({ where: { userId } })
  await db.circleMatch.deleteMany({ where: { userId } })
  await db.todo.deleteMany({ where: { userId } })
  await db.project.deleteMany({ where: { userId } })
  await db.circle.deleteMany({ where: { userId } })
  await db.connection.deleteMany({ where: { userId } })
  await db.brief.deleteMany({ where: { userId } })

  await db.connection.createMany({ data: rows.connections })
  await db.circle.createMany({ data: rows.circles })
  await db.project.createMany({ data: rows.projects })
  await db.todo.createMany({ data: rows.todos })
  await db.circleMatch.createMany({ data: rows.circleMatches })
  await db.overlapNote.createMany({ data: rows.overlapNotes })
  await db.slot.createMany({ data: rows.slots })
  await db.brief.createMany({ data: rows.briefs })
  await db.calendarEvent.createMany({ data: rows.calendarEvents })
  await db.timelineHour.createMany({ data: rows.timelineHours })
  await db.signal.createMany({ data: rows.signals })
}
