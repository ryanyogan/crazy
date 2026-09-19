import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * How an hour is drawn: a meeting is a tinted fill, a focus block is framed, a
 * free hour is dashed. With the Billing module on an hour also says what became
 * of it — `tracked` is the hour the timer is in now, `logged` is one that has
 * hours in it already (frame 2a).
 */
export type TimelineRowKind = 'meeting' | 'focus' | 'slotted' | 'free' | 'tracked' | 'logged'

const KIND_WORDS: Record<TimelineRowKind, string | null> = {
  meeting: 'Meeting',
  focus: 'Focus block',
  slotted: null,
  free: 'Free',
  tracked: 'Tracking now',
  logged: 'Logged',
}

/**
 * An hour-by-hour timeline. On a desktop it is a column of rows under their
 * hour; on a phone the same rows are a strip of cells that scrolls sideways.
 */
export function Timeline({ className, ...rest }: ComponentPropsWithoutRef<'ol'>) {
  return <ol className={className ? `tl ${className}` : 'tl'} {...rest} />
}

type TimelineRowProps = {
  /** The hour, as the row's label: "09". */
  label: string
  kind: TimelineRowKind
  title: string
  note?: string | null
  /**
   * The colour of the rule down the hour's left edge, which says whose work it
   * is; nothing where the hour belongs to nobody (frame 2a). A token, always.
   */
  rule?: string | null
  /** The tracked time in the hour, as the row's right-hand figure: "1:42". */
  figure?: string | null
  /** What follows the note: a source chip, or the Client's code with the Billing module on. */
  children?: ReactNode
  /**
   * Anything else a screen hangs on the row, such as a drop target for a Todo
   * dragged onto the hour. From 900px the row is `display: contents` and draws
   * no box of its own, so what it is given is reached by what bubbles up from
   * its parts rather than by the pointer landing on the row itself.
   */
} & Omit<ComponentPropsWithoutRef<'li'>, 'children' | 'title'>

export function TimelineRow({
  label,
  kind,
  title,
  note,
  rule,
  figure,
  children,
  className,
  ...rest
}: TimelineRowProps) {
  return (
    <li className={[`tl-row tl-row--${kind}`, className].filter(Boolean).join(' ')} {...rest}>
      <div className="tl-row__label">{label}</div>
      <div className="tl-row__body">
        <div className="tl-row__box">
          {rule !== undefined && (
            <span className="tl-row__rule" style={{ background: rule ?? 'transparent' }} />
          )}
          <span className="tl-row__title">
            {KIND_WORDS[kind] && <span className="sr-only">{KIND_WORDS[kind]}: </span>}
            {title}
          </span>
          {note && <span className="tl-row__note">{note}</span>}
          {children}
          {figure !== undefined && (
            <span className="tl-row__figure">
              {figure && <span className="sr-only">Tracked </span>}
              {figure}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
