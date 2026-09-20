import type { Chapter as ChapterModel } from '@crazy/shared'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * One chapter of the rundown: a disclosure whose head is the whole of what the
 * closed page says. The kicker names it, the count says how much of it there
 * is, and the sentence — derived in `packages/shared` from the day's own rows,
 * never stored and never canned — says what it comes to. Open, it holds the
 * place the work is actually done.
 */
export function Chapter({
  chapter,
  open,
  onToggle,
  children,
}: {
  chapter: ChapterModel
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const bodyId = `${chapter.name}-body`
  return (
    <section
      className={open ? 'ch ch--open' : 'ch'}
      id={chapter.name}
      aria-labelledby={`${chapter.name}-head`}
    >
      <h2 className="ch__title">
        <button
          type="button"
          id={`${chapter.name}-head`}
          className="ch__head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="ch__name">
            <span className="ch__kicker">{chapter.kicker}</span>
            {chapter.count !== null && (
              <span className="ch__count">
                {chapter.count}
                <span className="sr-only"> {chapter.count === 1 ? 'item' : 'items'}</span>
              </span>
            )}
          </span>
          <span className="ch__sentence">{chapter.sentence}</span>
          <ChevronDown className="ch__chev" size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </h2>
      <div className="ch__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
