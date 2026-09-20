import type { Chapter, ChapterName } from '@crazy/shared'
import { useEffect, useState } from 'react'

/**
 * The chapters by name, each a link into its own. The one the reader is in is
 * marked, answered by an `IntersectionObserver` rather than a scroll listener:
 * nothing here runs per frame.
 *
 * On a desktop it sits in the sticky aside; on a phone it is a row of chips
 * under the ribbon, which is the same list said in the width there is.
 */
export function ChapterIndex({
  chapters,
  onPick,
}: {
  chapters: Chapter[]
  onPick: (name: ChapterName) => void
}) {
  const here = useChapterInView(chapters)
  return (
    <nav className="index" aria-label="The chapters of today">
      <ul className="index__list">
        {chapters.map((chapter) => (
          <li key={chapter.name}>
            <a
              href={`#${chapter.name}`}
              className={chapter.name === here ? 'index__link index__link--here' : 'index__link'}
              aria-current={chapter.name === here ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault()
                onPick(chapter.name)
              }}
            >
              <span className="index__name">{chapter.kicker}</span>
              {chapter.count !== null && <span className="index__count">{chapter.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Which chapter is nearest the top of the screen. Null until the page has been looked at. */
function useChapterInView(chapters: Chapter[]): ChapterName | null {
  const [here, setHere] = useState<ChapterName | null>(null)
  const names = chapters.map((chapter) => chapter.name).join(',')

  useEffect(() => {
    const seen = new Map<string, number>()
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity)
        }
        // The chapter highest on the screen that is still on it; the band the
        // observer watches is the top third, so it is the one being read.
        const nearest = [...seen.entries()]
          .filter(([, top]) => Number.isFinite(top))
          .sort((a, b) => a[1] - b[1])[0]
        setHere((nearest?.[0] as ChapterName | undefined) ?? null)
      },
      { rootMargin: '0px 0px -66% 0px', threshold: 0 },
    )
    for (const name of names.split(',')) {
      const node = document.getElementById(name)
      if (node) watch.observe(node)
    }
    return () => watch.disconnect()
  }, [names])

  return here
}
