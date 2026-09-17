import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/** How an hour is drawn: a meeting is a tinted fill, a focus block is framed, a free hour is dashed. */
export type TimelineRowKind = 'meeting' | 'focus' | 'slotted' | 'free'

const KIND_WORDS: Record<TimelineRowKind, string | null> = {
  meeting: 'Meeting',
  focus: 'Focus block',
  slotted: null,
  free: 'Free',
}

/**
 * An hour-by-hour timeline. On a desktop it is a column of rows under their
 * hour; on a phone the same rows are a strip of cells that scrolls sideways.
 */
export function Timeline({ className, ...rest }: ComponentPropsWithoutRef<'ol'>) {
  return <ol className={className ? `tl ${className}` : 'tl'} {...rest} />
}

interface TimelineRowProps {
  /** The hour, as the row's label: "09". */
  label: string
  kind: TimelineRowKind
  title: string
  note?: string | null
  /** What follows the note: a source chip. */
  children?: ReactNode
}

export function TimelineRow({ label, kind, title, note, children }: TimelineRowProps) {
  return (
    <li className={`tl-row tl-row--${kind}`}>
      <div className="tl-row__label">{label}</div>
      <div className="tl-row__body">
        <div className="tl-row__box">
          <span className="tl-row__title">
            {KIND_WORDS[kind] && <span className="sr-only">{KIND_WORDS[kind]}: </span>}
            {title}
          </span>
          {note && <span className="tl-row__note">{note}</span>}
          {children}
        </div>
      </div>
    </li>
  )
}
