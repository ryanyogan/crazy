import type { Persona } from '@crazy/shared'
import type { Db } from '../client'
import { cori } from './cori'
import { ryan } from './ryan'

// The persona seed: the mockups' sample content, stored exactly where real and
// generated data will live, so the screens do not change when those arrive.
// It writes, so only the Coordinator may run it (ADR 0002).

/**
 * Whether a persona's world is seeded with their timer running, as the mockups
 * draw it, or with that Time entry already ended. The idle bar cannot be seen
 * any other way at a pinned moment: stopping it would stamp the real clock.
 */
export type SeedTimer = 'running' | 'idle'

export interface SeedInput {
  persona: Persona
  userId: string
  /** The moment the mockups' "now" is laid over: their Wednesday 08:41 becomes this day. */
  now: Date
  timeZone: string
  /** Development only; 'running' when nothing says otherwise. */
  timer?: SeedTimer
}

const PERSONA_SEEDS = { ryan, cori } satisfies Record<Persona, unknown>

/**
 * Replaces everything the user has with the persona's content. D1 has no
 * transactions: rows go child-first out and parent-first in, so a run that
 * stops half way is put right by running it again.
 */
export async function seedPersona(db: Db, input: SeedInput): Promise<void> {
  const { userId } = input
  const rows = PERSONA_SEEDS[input.persona](input)

  await db.invoiceLine.deleteMany({ where: { userId } })
  await db.invoice.deleteMany({ where: { userId } })
  await db.timeEntry.deleteMany({ where: { userId } })
  await db.metricSnapshot.deleteMany({ where: { userId } })
  await db.signal.deleteMany({ where: { userId } })
  await db.weekDayLine.deleteMany({ where: { userId } })
  await db.weekDayNote.deleteMany({ where: { userId } })
  await db.meetingPrep.deleteMany({ where: { userId } })
  await db.tieIn.deleteMany({ where: { userId } })
  await db.timelineHour.deleteMany({ where: { userId } })
  await db.calendarEvent.deleteMany({ where: { userId } })
  await db.slot.deleteMany({ where: { userId } })
  await db.overlapNote.deleteMany({ where: { userId } })
  await db.circleMatch.deleteMany({ where: { userId } })
  // Said outright rather than left to the Todo's cascade, as every other child
  // here is. The bytes in R2 are not the seed's to delete: a reseeded
  // development bucket keeps objects nothing points at (docs/BRIEF.md).
  await db.attachment.deleteMany({ where: { userId } })
  await db.todo.deleteMany({ where: { userId } })
  await db.project.deleteMany({ where: { userId } })
  await db.client.deleteMany({ where: { userId } })
  await db.circle.deleteMany({ where: { userId } })
  await db.connection.deleteMany({ where: { userId } })
  await db.brief.deleteMany({ where: { userId } })

  await db.connection.createMany({ data: rows.connections })
  await db.circle.createMany({ data: rows.circles })
  await db.client.createMany({ data: rows.clients })
  await db.project.createMany({ data: rows.projects })
  await db.todo.createMany({ data: rows.todos })
  await db.circleMatch.createMany({ data: rows.circleMatches })
  await db.overlapNote.createMany({ data: rows.overlapNotes })
  await db.slot.createMany({ data: rows.slots })
  await db.brief.createMany({ data: rows.briefs })
  await db.weekDayNote.createMany({ data: rows.weekDayNotes })
  await db.tieIn.createMany({ data: rows.tieIns })
  await db.calendarEvent.createMany({ data: rows.calendarEvents })
  // What Crazy wrote to prepare for each of the day's meetings (ticket 28).
  await db.meetingPrep.createMany({ data: rows.meetingPreps })
  // A day's wording is kept beside the Todo or the meeting it words.
  await db.weekDayLine.createMany({ data: rows.weekDayLines })
  await db.timelineHour.createMany({ data: rows.timelineHours })
  await db.signal.createMany({ data: rows.signals })
  // What Crazy modelled for the Metrics screen, beside the figures it counts.
  await db.metricSnapshot.createMany({ data: rows.metricSnapshots })
  await db.timeEntry.createMany({ data: rows.timeEntries })
  // The period's invoices, and the lines `draftInvoice` built from those entries.
  await db.invoice.createMany({ data: rows.invoices })
  await db.invoiceLine.createMany({ data: rows.invoiceLines })
}
