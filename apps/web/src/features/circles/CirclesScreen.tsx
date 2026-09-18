import { viewCircles } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { circlesQuery } from '#/lib/queries'
import { CircleFigure } from './CircleFigure'
import { OverlapCard } from './OverlapCard'

/**
 * The Circles screen, frame 1e. One DOM serves both widths: on a phone the two
 * columns fall into one, the figure first and the Overlaps under it.
 *
 * Nothing here is wired, because nothing here is a change: Circles are read,
 * and the note says they are the user's to correct — which is a promise about
 * renaming and merging, not a control this screen draws (spec, out of scope).
 */
export function CirclesScreen() {
  const { data: circles } = useSuspenseQuery(circlesQuery)
  const view = viewCircles(circles)

  return (
    <div className="screen circles">
      <div className="circles__map">
        <h1 className="screen__title">Circles</h1>
        <p className="circles__lede">{view.lede}</p>
        <CircleFigure {...view} />
      </div>

      <section className="circles__overlaps" aria-labelledby="overlaps-title">
        <h2 id="overlaps-title" className="circles__kicker">
          Overlaps this week
        </h2>
        {view.overlaps.length === 0 ? (
          <p className="circles__empty">No Todo serves two Circles this week.</p>
        ) : (
          <ul className="circles__list">
            {view.overlaps.map((overlap) => (
              <OverlapCard key={overlap.todoId} overlap={overlap} />
            ))}
          </ul>
        )}
        {/* The frame says "groups" and "tools"; the glossary keeps those words
            off a Circle and a Provider, so the harness draws the frame saying
            what this says (COPY in tools/visual/src/targets.ts). */}
        <p className="circles__note">
          Circles are inferred from who you talk to and which Providers the work lives in. Rename or
          merge them; Today learns.
        </p>
      </section>
    </div>
  )
}
