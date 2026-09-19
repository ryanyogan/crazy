import { type Command, type Patch, covers, decide } from '@crazy/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendCommand } from '#/server/functions'
import { browserNow } from './clock'
import { liveFor } from './live'
import { notify } from './notices'
import { applyToCache, integrationsQuery, todayQuery } from './queries'

/** The Coordinator said no. Its reason is written for the user. */
class CommandRefused extends Error {}

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

  return useMutation({
    mutationFn: async (command: Command): Promise<Patch> => {
      const result = await sendCommand({ data: command })
      if (!result.ok) throw new CommandRefused(result.reason)
      return result.patch
    },
    onMutate: async (command) => {
      // A fetch already in flight would land after the optimistic update and undo it.
      await queryClient.cancelQueries({ queryKey: todayQuery.queryKey })
      await queryClient.cancelQueries({ queryKey: integrationsQuery.queryKey })
      const before = queryClient.getQueryData(todayQuery.queryKey)
      const integrations = queryClient.getQueryData(integrationsQuery.queryKey)
      // Decided against whatever this browser holds: the day if it has read it,
      // the Connections if it has read those. A row it does not hold is refused
      // here and guessed at not at all; the Coordinator decides against D1.
      const decision = decide(
        {
          day: before?.day ?? '',
          todos: before?.todos ?? [],
          signals: before?.signals ?? [],
          events: before?.events ?? [],
          connections: integrations?.connections ?? [],
        },
        command,
        browserNow(),
      )
      if (decision.ok) applyToCache(queryClient, decision.ops)
      return { before, integrations, guess: decision.ok ? decision.ops : [] }
    },
    onSuccess: (patch, _command, context) => {
      // The Coordinator's word replaces the guess: its moment, not the browser's.
      applyToCache(queryClient, patch.ops)
      // The socket brings the same patch; it is not to be applied a second time.
      liveFor(queryClient).applied(patch.seq)
      // A row the guess touched and the patch did not is still the guess. Only a
      // read can say what it should be; putting `before` back would throw away
      // any patch that landed over the socket while this was in flight.
      if (context && !covers(context.guess, patch.ops)) {
        void queryClient.invalidateQueries({ queryKey: todayQuery.queryKey })
        void queryClient.invalidateQueries({ queryKey: integrationsQuery.queryKey })
      }
    },
    onError: (error, _command, context) => {
      if (context?.before) queryClient.setQueryData(todayQuery.queryKey, context.before)
      if (context?.integrations) {
        queryClient.setQueryData(integrationsQuery.queryKey, context.integrations)
      }
      notify(
        error instanceof CommandRefused
          ? error.message
          : 'That did not reach Crazy, so it has been put back. Check your connection and try again.',
      )
      void queryClient.invalidateQueries({ queryKey: todayQuery.queryKey })
      void queryClient.invalidateQueries({ queryKey: integrationsQuery.queryKey })
    },
  })
}
