import { localTimeToInstant, viewProjects } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readProjects } from './projects'

// Frame 1d's moment: Wednesday 17 Sep 2025, 08:41 on Ryan's wall clock.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T08:41')
const userId = 'user_ryan'

async function projects(moment = now, user = userId) {
  const held = await readProjects(createReadDb(env.DB), user, moment, timeZone)
  return { ...held, ...viewProjects(held, moment) }
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
})

it('reads each Project as frame 1d draws it, with its progress counted from its Todos', async () => {
  const { projects: rows } = await projects()

  expect(
    rows.map((project) => [
      project.row.name,
      project.circle,
      project.open,
      project.status.label,
      `${project.progress}%`,
      project.milestone,
      project.today,
    ]),
  ).toEqual([
    [
      'Auth migration',
      'Platform team',
      '12 open',
      'On track',
      '68%',
      'Edge sessions live · Fri 19 Sep',
      '2 Todos',
    ],
    [
      'Onboarding redesign',
      'Platform team',
      '5 open',
      'At risk',
      '40%',
      'v2 ships · Thu 18 Sep',
      '1 Todo',
    ],
    ['Q4 planning', 'Leadership', '4 open', 'Behind', '25%', 'Doc review · Mon 22 Sep', '1 Todo'],
    ['Apartment move', 'Personal', '7 open', 'On track', '55%', 'Move day · 1 Oct', '1 Todo'],
    ['Half marathon', 'Personal', '3 open', 'Week 9 of 12', '75%', 'Race · 5 Oct', '—'],
  ])

  // Nothing above is stored: the percentage is the Todos done over every Todo
  // the Project has ever held.
  expect(rows[0]?.row.counts).toEqual({ open: 12, today: 2, done: 25, total: 37 })
})

it('opens a Project on what it has today and the head of its backlog, with ages', async () => {
  const [auth] = (await projects()).projects

  expect(auth?.todayTodos.map(({ title }) => title)).toEqual([
    'Finish Cloudflare session-token spike',
    'Reply to Priya on edge rate limits',
  ])
  expect(auth?.backlog.count).toBe(10)
  expect(auth?.backlog.head.map(({ todo, age }) => [todo.title, age])).toEqual([
    ['Write migration runbook', '4d'],
    ['Load-test edge sessions', '6d'],
    ['Deprecate legacy cookie path', '12d'],
  ])
})

it('counts what the archive takes next from how long the backlog has gone untouched', async () => {
  const { archiveSoon, lifecycle } = await projects()

  expect(archiveSoon).toMatchObject({ count: 6, inDays: 12 })
  expect(lifecycle).toBe(
    'Lifecycle: today → untouched a day → backlog → untouched 90 days → archive. 6 backlog Todos archive in 12 days.',
  )
})

it('lists the Promises and the Waiting on, and only the Promises can become Todos', async () => {
  const { promises, waitingOn, unaddedPromises } = await projects()

  expect(promises.map(({ text, who }) => `${text} · to ${who}`)).toEqual([
    'Send the rate-limit numbers · to Priya',
    'Share the migration runbook · to Design',
    'Reply about key handover · to landlord',
  ])
  expect(waitingOn.map(({ who, text }) => `${who} · ${text}`)).toEqual([
    'Sam · updated PR after your comments',
    'Devon · feedback on Q4 section 1',
    'Movers · confirm 1 Oct slot',
  ])
  // None has been added yet, and no Waiting on is ever offered.
  expect(unaddedPromises).toHaveLength(3)
  expect(waitingOn.every((signal) => signal.kind === 'waiting_on')).toBe(true)
})

it('shows one Side of a life at a time', async () => {
  const held = await readProjects(createReadDb(env.DB), userId, now, timeZone)

  const names = (filter: 'all' | 'work' | 'personal') =>
    viewProjects(held, now, filter).projects.map((project) => project.row.name)

  expect(names('work')).toEqual(['Auth migration', 'Onboarding redesign', 'Q4 planning'])
  expect(names('personal')).toEqual(['Apartment move', 'Half marathon'])
  expect(names('all')).toHaveLength(5)
})

it('reads only the rows of the user asking', async () => {
  expect(await projects(now, 'user_someone_else')).toMatchObject({
    projects: [],
    signals: [],
    archiveSoon: null,
  })
})
