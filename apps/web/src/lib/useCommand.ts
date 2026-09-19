import {
  type Command,
  type CommandState,
  type Decision,
  type Patch,
  type TimeEntryFacts,
  type TimeRead,
  type TimerPicker,
  type TodayTimer,
  covers,
  decide,
  signalsNamed,
} from '@crazy/shared'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendCommand } from '#/server/functions'
import { browserNow } from './clock'
import { liveFor } from './live'
import { notify } from './notices'
import {
  TIME_KEY,
  applyToCache,
  integrationsQuery,
  projectsQuery,
  shellQuery,
  timerQuery,
  todayQuery,
} from './queries'

/** The Coordinator said no. Its reason is written for the user. */
class CommandRefused extends Error {}

/**
 * What this browser knows of the user's Time entries, and of the Clients and
 * Projects a timer command may name. The entries are the ones the bar holds:
 * today's, the last one, and the running one. The Clients and Projects are the
 * picker's own lists, which are every one the user has — so any work the picker
 * offers can be decided here, and a Project named a moment ago is among them.
 * The Coordinator decides against every row in D1 regardless, so a command this
 * guess allows and the truth refuses is simply put back.
 */
function timerFacts(
  held: { timer?: TodayTimer | null; picker?: TimerPicker | null },
  periods: readonly TimeRead[],
): Partial<CommandState> {
  const { timer, picker } = held
  if (!timer && periods.length === 0) return {}
  const entries = new Map<string, TimeEntryFacts>()
  for (const entry of [timer?.running, timer?.last, ...(timer?.today ?? [])]) {
    if (!entry) continue
    entries.set(entry.id, {
      id: entry.id,
      clientId: entry.clientId,
      clientName: entry.clientName,
      projectId: entry.projectId,
      todoId: entry.todoId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    })
  }
  // The timesheet's own rows, for every period this tab has read: an entry
  // being edited on the Time screen is last week's, which the bar never holds.
  for (const period of periods) {
    for (const row of period.rows) {
      entries.set(row.id, {
        id: row.id,
        clientId: row.clientId,
        clientName: row.clientName,
        projectId: row.projectId,
        todoId: null,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        suggestedClientId: row.suggestedClientId,
        suggestedProjectId: row.suggestedProjectId,
      })
    }
  }

  const fromPeriods = periods[0]
  return {
    timeEntries: [...entries.values()],
    projects:
      picker?.clients.flatMap((client) =>
        client.projects.map((project) => ({ id: project.id, clientId: client.id })),
      ) ??
      fromPeriods?.projects.map((project) => ({ id: project.id, clientId: project.clientId })) ??
      [],
    clients:
      picker?.clients
        .filter((client) => client.id !== null)
        .map((client) => ({ id: client.id as string })) ??
      fromPeriods?.clients.map((client) => ({ id: client.id })) ??
      [],
  }
}

/** Every period of the timesheet this tab has read, newest read first. */
function periodsHeld(queryClient: QueryClient): TimeRead[] {
  return queryClient
    .getQueriesData<{ time?: TimeRead }>({ queryKey: TIME_KEY })
    .map(([, data]) => data?.time)
    .filter((period) => period !== undefined)
}

/**
 * The state the command is decided against, gathered from whatever this browser
 * holds. The Signals come from the cache holding every one the command names —
 * a Mention is on Today and a Promise is on Projects, and neither screen holds
 * the other's — and that same cache gives the day, its Todos and, if it is
 * Today's, the day's calendar. The Connections come from the Integrations
 * cache. A row this browser does not hold is guessed at not at all; the
 * Coordinator decides against D1.
 */
function commandState(queryClient: QueryClient, command: Command): CommandState {
  const today = queryClient.getQueryData(todayQuery.queryKey)
  const projects = queryClient.getQueryData(projectsQuery.queryKey)
  const integrations = queryClient.getQueryData(integrationsQuery.queryKey)
  const shell = queryClient.getQueryData(shellQuery.queryKey)
  const timer = queryClient.getQueryData(timerQuery.queryKey)
  const named = signalsNamed(command)
  // A command that names no Signal is decided against the day if it has been
  // read, and otherwise against whatever the Projects screen read.
  const rows =
    named.length === 0
      ? (today ?? projects)
      : [today, projects].find(
          (cached) => cached && named.every((id) => cached.signals.some((each) => each.id === id)),
        )
  return {
    day: rows?.day ?? '',
    todos: rows?.todos ?? [],
    signals: rows?.signals ?? [],
    // Only a command that plans the day is decided against the day, and only
    // Today's cache holds one.
    events: rows && 'events' in rows ? rows.events : [],
    connections: integrations?.connections ?? [],
    // The timer is the Billing module's, and it has a cache of its own: the
    // Shell loads it for every screen, because the header follows the user.
    billing: shell?.billing ?? false,
    // The one rule that says a time out loud is the overlap: it names the
    // hours it clashed with, on the user's own wall clock.
    ...(shell ? { timeZone: shell.timeZone } : {}),
    ...timerFacts(timer ?? {}, periodsHeld(queryClient)),
  }
}

/**
 * What this browser would answer if the command were sent. It is the same
 * `decide` the Coordinator runs, against the same cache the optimistic update
 * uses, so a screen can say why a change will not do *beside the field it is
 * about* rather than waiting for a notice from the server. The Coordinator
 * decides again regardless; this never stands in for its answer.
 */
export function useDecide(): (command: Command) => Decision {
  const queryClient = useQueryClient()
  return (command) => decide(commandState(queryClient, command), command, browserNow())
}

/**
 * The one way the browser changes anything. The command is decided here first,
 * by the same `decide` the Coordinator runs, and applied to the cache at once;
 * then it is sent. If the Coordinator refuses or cannot be reached the cache is
 * put back, the user is told, and the truth is fetched again. The browser
 * decides against a cache that holds less than D1 does, so the Coordinator may
 * rightly answer with fewer rows than the guess touched; what the patch does
 * not cover is left over in the cache, and is read again rather than guessed at.
 */
export function useCommand() {
  const queryClient = useQueryClient()
  const readAgain = () => {
    void queryClient.invalidateQueries({ queryKey: todayQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: projectsQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: integrationsQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: timerQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: TIME_KEY })
  }

  return useMutation({
    mutationFn: async (command: Command): Promise<Patch> => {
      const result = await sendCommand({ data: command })
      if (!result.ok) throw new CommandRefused(result.reason)
      return result.patch
    },
    onMutate: async (command) => {
      // A fetch already in flight would land after the optimistic update and undo it.
      await queryClient.cancelQueries({ queryKey: todayQuery.queryKey })
      await queryClient.cancelQueries({ queryKey: projectsQuery.queryKey })
      await queryClient.cancelQueries({ queryKey: integrationsQuery.queryKey })
      await queryClient.cancelQueries({ queryKey: timerQuery.queryKey })
      await queryClient.cancelQueries({ queryKey: TIME_KEY })
      const before = {
        today: queryClient.getQueryData(todayQuery.queryKey),
        projects: queryClient.getQueryData(projectsQuery.queryKey),
        integrations: queryClient.getQueryData(integrationsQuery.queryKey),
        timer: queryClient.getQueryData(timerQuery.queryKey),
        // Every period the tab has read, each put back under its own key.
        time: queryClient.getQueriesData({ queryKey: TIME_KEY }),
      }
      const decision = decide(commandState(queryClient, command), command, browserNow())
      if (decision.ok) applyToCache(queryClient, decision.ops)
      return { before, guess: decision.ok ? decision.ops : [] }
    },
    onSuccess: (patch, _command, context) => {
      // The Coordinator's word replaces the guess: its moment, not the browser's.
      applyToCache(queryClient, patch.ops)
      // The socket brings the same patch; it is not to be applied a second time.
      liveFor(queryClient).applied(patch.seq)
      // A row the guess touched and the patch did not is still the guess. Only a
      // read can say what it should be; putting `before` back would throw away
      // any patch that landed over the socket while this was in flight.
      if (context && !covers(context.guess, patch.ops)) readAgain()
    },
    onError: (error, _command, context) => {
      const { today, projects, integrations, timer, time } = context?.before ?? {}
      if (today) queryClient.setQueryData(todayQuery.queryKey, today)
      if (projects) queryClient.setQueryData(projectsQuery.queryKey, projects)
      if (integrations) queryClient.setQueryData(integrationsQuery.queryKey, integrations)
      if (timer) queryClient.setQueryData(timerQuery.queryKey, timer)
      for (const [key, held] of time ?? []) if (held) queryClient.setQueryData(key, held)
      notify(
        error instanceof CommandRefused
          ? error.message
          : 'That did not reach Crazy, so it has been put back. Check your connection and try again.',
      )
      readAgain()
    },
  })
}
