import {
  type ArchiveSoon,
  type ProjectRow,
  type ProjectTodo,
  type Projects,
  SETTINGS_DEFAULTS,
  type Signal,
  archiveDayOf,
  daysUntil,
  energy,
  projectStatus,
  side as sideOf,
  signalKind,
  sourceKind,
  todoState,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * A user's Projects as D1 holds them at one moment: each with its Circle, its
 * Todos counted by state, and the head of its backlog; the Promises and the
 * Waiting on beside them; and when the backlog next crosses the archive period.
 *
 * Every figure the screen shows is counted here and none is stored, so a
 * percentage can never go stale. What the screen makes of the counts — the
 * progress bar, the ages, the filter — is `viewProjects`'s to derive.
 */
export async function readProjects(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<Projects> {
  const { day } = wallClock(now, timeZone)

  const [settings, projects, counted, todos, signals, backlog] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId },
      select: { sentBackDays: true, archiveDays: true },
    }),
    db.project.findMany({
      where: { userId },
      // Oldest first: the order the work was taken on.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        statusNote: true,
        milestone: true,
        milestoneDay: true,
        circle: { select: { id: true, name: true, side: true } },
      },
    }),
    // Progress, the open count and what is on today, counted rather than stored.
    db.todo.groupBy({
      by: ['projectId', 'state'],
      where: { userId, projectId: { not: null } },
      _count: { _all: true },
    }),
    // What an expanded Project lists: its `today` Todos (and any it finished
    // today), and the head of its backlog. The whole backlog is counted above;
    // only its first few have room on the card.
    db.todo.findMany({
      where: { userId, projectId: { not: null }, state: { in: ['today', 'backlog'] } },
      include: {
        project: { select: { name: true, clientId: true, client: { select: { name: true } } } },
        slots: { where: { userId, day }, select: { hour: true }, orderBy: { hour: 'asc' } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    // The Promises and the Waiting on, in the order Crazy noticed them, newest
    // first. When it noticed one is not when it happened: a week-old promise
    // can reach Crazy this morning, and the list is a feed of its looking.
    db.signal.findMany({
      where: { userId, kind: { in: ['promise', 'waiting_on'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    // Every backlog Todo's last touch, which is what its archive day is counted
    // from. Only the day it falls on is kept, so this stays a column read.
    db.todo.findMany({
      where: { userId, state: 'backlog' },
      select: { touchedAt: true },
    }),
  ])

  const lifecycle = {
    sentBackDays: settings?.sentBackDays ?? SETTINGS_DEFAULTS.sentBackDays,
    archiveDays: settings?.archiveDays ?? SETTINGS_DEFAULTS.archiveDays,
  }

  /** How many of one Project's Todos are in one state. */
  const countOf = (projectId: string, state: string) =>
    counted.find((row) => row.projectId === projectId && row.state === state)?._count._all ?? 0

  // The soonest day the backlog archives on, and how many cross with it. The
  // day is the user's own: an archive period is counted in Rollovers, not hours.
  const archiveDays = backlog.map((row) =>
    archiveDayOf(wallClock(row.touchedAt, timeZone).day, lifecycle.archiveDays),
  )
  const soonest = archiveDays.length === 0 ? null : archiveDays.reduce((a, b) => (a < b ? a : b))
  const archiveSoon: ArchiveSoon | null =
    soonest === null
      ? null
      : {
          count: archiveDays.filter((each) => each === soonest).length,
          day: soonest,
          inDays: daysUntil(day, soonest),
        }

  return {
    day,
    lifecycle,
    archiveSoon,
    projects: projects.map((row): ProjectRow => {
      const inToday = countOf(row.id, 'today')
      const open = inToday + countOf(row.id, 'backlog')
      const done = countOf(row.id, 'done')
      return {
        id: row.id,
        name: row.name,
        circle: row.circle
          ? { id: row.circle.id, name: row.circle.name, side: sideOf.parse(row.circle.side) }
          : null,
        status: projectStatus.parse(row.status),
        statusNote: row.statusNote,
        milestone: row.milestone,
        milestoneDay: row.milestoneDay,
        counts: { open, today: inToday, done, total: open + done + countOf(row.id, 'archived') },
      }
    }),
    todos: todos.map((row): ProjectTodo => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      state: todoState.parse(row.state),
      project: row.project?.name ?? null,
      clientId: row.project?.clientId ?? null,
      clientName: row.project?.client?.name ?? null,
      estimateMinutes: row.estimateMinutes,
      energy: row.energy === null ? null : energy.parse(row.energy),
      carryCount: row.carryCount,
      stackPosition: row.stackPosition,
      reason: row.stackReason,
      source:
        row.sourceConnectionId === null || row.sourceItemId === null || row.sourceKind === null
          ? null
          : {
              connectionId: row.sourceConnectionId,
              itemId: row.sourceItemId,
              kind: sourceKind.parse(row.sourceKind),
              ref: row.sourceRef,
              url: row.sourceUrl,
            },
      slotHours: row.slots.map((slot) => slot.hour),
      createdAt: row.createdAt.toISOString(),
      touchedAt: row.touchedAt.toISOString(),
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      swappedOnDay: row.swappedOnDay,
      doneAt: row.doneAt?.toISOString() ?? null,
    })),
    signals: signals.map((row): Signal => ({
      id: row.id,
      kind: signalKind.parse(row.kind),
      who: row.person,
      text: row.text,
      at: row.at.toISOString(),
      source: {
        connectionId: row.connectionId,
        itemId: row.sourceItemId,
        kind: sourceKind.parse(row.sourceKind),
        ref: row.sourceRef,
        url: row.sourceUrl,
      },
      todoId: row.todoId,
    })),
  }
}
