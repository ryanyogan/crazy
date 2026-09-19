import {
  LIFECYCLE_LIMITS,
  type LifecycleChange,
  type LifecycleSettings,
  type Realtime,
  WAKE_WORDS,
  clockTime,
  daysLabel,
} from '@crazy/shared'
import { Blueprint, NotWired } from '@crazy/ui'
import { useLiveStatus } from '#/lib/live'
import { useCommand } from '#/lib/useCommand'

const SOCKET_WORDS = {
  live: 'Connected · sleeping',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
} as const

const SENT_BACK_CHOICES = [1, 2, 3, 5, 7, 14, LIFECYCLE_LIMITS.sentBackDays]
const ARCHIVE_CHOICES = [30, 60, 90, 180, LIFECYCLE_LIMITS.archiveDays]

/** The choices offered, and the one held even if it is none of them. */
const withHeld = (choices: number[], held: number) =>
  [...new Set([...choices, held])].sort((a, b) => a - b)

interface RealtimeCardProps {
  realtime: Realtime
  settings: LifecycleSettings
  timeZone: string
}

/**
 * The socket's true state (this browser's), the Coordinator's own wake
 * counters, and the lifecycle settings, which are commands like any change.
 */
export function RealtimeCard({ realtime, settings, timeZone }: RealtimeCardProps) {
  const status = useLiveStatus()
  const command = useCommand()
  const set = (change: LifecycleChange) => command.mutate({ type: 'settings.set', set: change })
  const { lastWake, wakesSince } = realtime

  return (
    <Blueprint as="section" className="card realtime" aria-labelledby="realtime-title">
      <h2 id="realtime-title" className="card-kicker">
        Realtime
      </h2>
      <output className="realtime__state" data-state={status.state}>
        <span className="realtime__dot" aria-hidden="true" />
        {SOCKET_WORDS[status.state]}
      </output>
      <p className="realtime__note">
        Your socket wakes when something that matters to you changes, pushes the patch, then sleeps.{' '}
        Woke {wakesSince} {wakesSince === 1 ? 'time' : 'times'} today
        {lastWake && (
          <>
            ; last at {clockTime(new Date(lastWake.at), timeZone)} ({WAKE_WORDS[lastWake.cause]})
          </>
        )}
        .
      </p>

      <div className="realtime__settings">
        <div className="setting">
          <span id="hourly-status">Hourly status line</span>
          <NotWired why="The hourly status line is not built yet">
            <button
              type="button"
              role="switch"
              aria-checked="false"
              aria-labelledby="hourly-status"
              className="switch"
            />
          </NotWired>
        </div>
        <label className="setting">
          Morning Brief at
          <input
            type="time"
            className="input setting__input"
            value={settings.briefTime}
            onChange={(event) => event.target.value && set({ briefTime: event.target.value })}
          />
        </label>
        <label className="setting">
          Send back untouched after
          <select
            className="input setting__input"
            value={settings.sentBackDays}
            onChange={(event) => set({ sentBackDays: Number(event.target.value) })}
          >
            {withHeld(SENT_BACK_CHOICES, settings.sentBackDays).map((days) => (
              <option key={days} value={days}>
                {daysLabel(days)}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          Archive after
          <select
            className="input setting__input"
            value={settings.archiveDays}
            onChange={(event) => set({ archiveDays: Number(event.target.value) })}
          >
            {withHeld(ARCHIVE_CHOICES, settings.archiveDays).map((days) => (
              <option key={days} value={days}>
                {daysLabel(days)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Blueprint>
  )
}
