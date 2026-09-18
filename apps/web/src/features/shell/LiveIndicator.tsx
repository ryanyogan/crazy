import { clockTime } from '@crazy/shared'
import { useLiveStatus } from '#/lib/live'

const WORDS = {
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
} as const

/**
 * Whether this screen is current: the state of the socket to the Coordinator.
 * Live, the rail says when the Coordinator last woke and a phone's top bar
 * shows the time the screen was loaded at, as frame 1a draws them. The dot is
 * solid only while live.
 */
export function LiveIndicator({ now, timeZone }: { now: string; timeZone: string }) {
  const status = useLiveStatus()

  return (
    <output className="live" data-state={status.state}>
      <span className="live__dot" aria-hidden="true" />
      {status.state === 'live' ? (
        <>
          <span className="live__rail">
            Live
            {status.wokeAt && (
              <>
                {' · woke '}
                <span className="live__woke">{clockTime(new Date(status.wokeAt), timeZone)}</span>
              </>
            )}
          </span>
          <span className="live__bar">
            <span className="sr-only">Live, as of </span>
            {clockTime(new Date(now), timeZone)}
          </span>
        </>
      ) : (
        WORDS[status.state]
      )}
    </output>
  )
}
