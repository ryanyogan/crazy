import {
  type Command,
  type CommandState,
  type Patch,
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
function timerFacts(held: {
  timer?: TodayTimer | null
  picker?: TimerPicker | null
}): Partial<CommandState> {
  const { timer, picker } = held
  if (!timer) return {}
  const entries = [
    ...new Map(
      [timer.running, timer.last, ...timer.today]
        .filter((entry) => entry !== null)
        .map((entry) => [entry.id, entry] as const),
    ).values(),
  ]

  return {
    timeEntries: entries.map(({ id, clientId, projectId, todoId, endedAt }) => ({
      id,
      clientId,
      projectId,
      todoId,
      endedAt,
    })),
    projects:
      picker?.clients.flatMap((client) =>
        client.projects.map((project) => ({ id: project.id, clientId: client.id })),
      ) ?? [],
    clients:
      picker?.clients
        .filter((client) => client.id !== null)
        .map((client) => ({ id: client.id as string })) ?? [],
  }
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
    ...timerFacts(timer ?? {}),
  }
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
      const before = {
        today: queryClient.getQueryData(todayQuery.queryKey),
        projects: queryClient.getQueryData(projectsQuery.queryKey),
        integrations: queryClient.getQueryData(integrationsQuery.queryKey),
        timer: queryClient.getQueryData(timerQuery.queryKey),
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
      const { today, projects, integrations, timer } = context?.before ?? {}
      if (today) queryClient.setQueryData(todayQuery.queryKey, today)
      if (projects) queryClient.setQueryData(projectsQuery.queryKey, projects)
      if (integrations) queryClient.setQueryData(integrationsQuery.queryKey, integrations)
      if (timer) queryClient.setQueryData(timerQuery.queryKey, timer)
      notify(
        error instanceof CommandRefused
          ? error.message
          : 'That did not reach Crazy, so it has been put back. Check your connection and try again.',
      )
      readAgain()
    },
  })
}
