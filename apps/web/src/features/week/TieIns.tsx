import type { TieIn } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'

/**
 * Where the user is the dependency, one card per Project. The words are
 * Crazy's, written with the Week brief; the Project is the row they hang on.
 */
export function TieIns({ tieIns }: { tieIns: TieIn[] }) {
  if (tieIns.length === 0) return null
  return (
    <section className="tieins" aria-labelledby="tieins-title">
      <h2 id="tieins-title" className="tieins__title">
        Where you tie in
      </h2>
      <div className="tieins__cards">
        {tieIns.map((tieIn) => (
          <Blueprint key={tieIn.project} className="card tiein">
            <div className="card-kicker">{tieIn.project}</div>
            <div className="tiein__text">{tieIn.text}</div>
            {tieIn.when && <div className="card-meta">{tieIn.when}</div>}
          </Blueprint>
        ))}
      </div>
    </section>
  )
}
