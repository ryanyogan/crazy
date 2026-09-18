import { type Command, type Patch, decide } from '@crazy/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendCommand } from '#/server/functions'
import { browserNow } from './clock'
import { liveFor } from './live'
import { notify } from './notices'
import { applyToCache, todayQuery } from './queries'

/** The Coordinator said no. Its reason is written for the user. */
class CommandRefused extends Error {}

/**
 * The one way the browser changes anything. The command is decided here first,
 * by the same `decide` the Coordinator runs, and applied to the cache at once;
 * then it is sent. If the Coordinator refuses or cannot be reached the cache is
 * put back, the user is told, and the truth is fetched again.
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
      const before = queryClient.getQueryData(todayQuery.queryKey)
      const decision = before && decide(before, command, browserNow())
      if (decision?.ok) applyToCache(queryClient, decision.ops)
      return { before }
    },
    onSuccess: (patch) => {
      // The Coordinator's word replaces the guess: its moment, not the browser's.
      applyToCache(queryClient, patch.ops)
      // The socket brings the same patch; it is not to be applied a second time.
      liveFor(queryClient).applied(patch.seq)
    },
    onError: (error, _command, context) => {
      if (context?.before) queryClient.setQueryData(todayQuery.queryKey, context.before)
      notify(
        error instanceof CommandRefused
          ? error.message
          : 'That did not reach Crazy, so it has been put back. Check your connection and try again.',
      )
      void queryClient.invalidateQueries({ queryKey: todayQuery.queryKey })
    },
  })
}
