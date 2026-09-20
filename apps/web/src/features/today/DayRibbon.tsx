import { type Ribbon, formatHour } from '@crazy/shared'
import type { CSSProperties } from 'react'
import { useTicking } from '#/features/timer/useTicking'

/**
 * The whole working day on one rule: the timeline said in a line, in the
 * blueprint's own vernacular — a measured rule with the hours written at its
 * ends. A meeting is an accent tint, a Todo's Slot a hairline box, a free hour
 * a dashed one, and with the Billing module on what was actually tracked is
 * drawn solid along the foot of the blocks it happened in.
 *
 * It is the one pretty thing on the screen; everything below it is typographic
 * and still. It says nothing to assistive technology — the Your day chapter's
 * sentence is the same day in words, and every block's chapter is reachable
 * from the index — so it is `aria-hidden` and its blocks are not controls.
 * Pressing one is a pointer's shortcut into Your day at that hour.
 */
export function DayRibbon({
  ribbon,
  readAt,
  onPick,
}: {
  ribbon: Ribbon
  /** The moment the loader handed over; the tick moves from it, never from a clock. */
  readAt: string
  onPick: () => void
}) {
  // The only moving thing on the page besides a chapter opening. It counts from
  // the moment the loader gave, so a tab left open all morning still agrees
  // with the hours under it (AGENTS.md, "The current time is always a parameter").
  const now = useTicking(readAt, ribbon.now !== null)
  const hours = ribbon.until - ribbon.from
  const into =
    ribbon.now === null
      ? null
      : Math.min(
          1,
          Math.max(0, (now.getTime() - Date.parse(readAt)) / (hours * 3_600_000) + ribbon.now),
        )

  return (
    <div className="ribbon" aria-hidden="true">
      <span className="ribbon__edge">{formatHour(ribbon.from).slice(0, 2)}</span>
      <div className="ribbon__rule">
        {ribbon.blocks.map((block) => (
          // A button rather than a box with a handler on it, but never in the
          // tab order: the ribbon is `aria-hidden`, and everything it reaches
          // is reached by a keyboard through the index and the chapter heads.
          <button
            key={block.from}
            type="button"
            tabIndex={-1}
            className={`ribbon__block ribbon__block--${block.kind}`}
            data-span={block.until - block.from}
            style={{ '--span': block.until - block.from } as CSSProperties}
            onClick={onPick}
          >
            {block.logged > 0 && (
              <span
                className="ribbon__logged"
                style={{ '--logged': block.logged } as CSSProperties}
              />
            )}
            <span className="ribbon__label">{block.label}</span>
          </button>
        ))}
        {into !== null && (
          <span className="ribbon__now" style={{ '--into': `${into * 100}%` } as CSSProperties} />
        )}
      </div>
      <span className="ribbon__edge">{formatHour(ribbon.until).slice(0, 2)}</span>
    </div>
  )
}
