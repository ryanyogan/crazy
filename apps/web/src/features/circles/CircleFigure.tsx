import { type CirclesView, LENS_SEATS, peopleLabel, providersLabel } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'
import { FIGURE_SIZE, LENS_LINE_GAP, LENS_MARKS, PEOPLE_LINE_GAP, SEAT_MARKS } from './figure'

/**
 * The figure frame 1e draws: each Circle as a ring, the work ones washed in and
 * crossing, a personal one dashed, with what Crazy has counted under each and
 * an Overlap written where two of them meet.
 *
 * The drawing says nothing the words cannot, so it is hidden from assistive
 * technology and its caption reads out the same Circles and the same Overlaps.
 */
export function CircleFigure({ seated, unseated, lenses }: CirclesView) {
  const marked = seated.map((each) => ({ ...each, mark: SEAT_MARKS[each.seatIndex] }))
  const nameOfSeat = new Map(seated.map(({ circle, seatIndex }) => [seatIndex, circle.name]))

  return (
    <>
      <Blueprint as="figure" className="circles__figure">
        <svg
          className="circles__drawing"
          viewBox={`0 0 ${FIGURE_SIZE.width} ${FIGURE_SIZE.height}`}
          width={FIGURE_SIZE.width}
          height={FIGURE_SIZE.height}
          aria-hidden="true"
        >
          <g className="circles__rings">
            {marked.map(({ circle, outline, mark }) =>
              mark === undefined ? null : (
                <circle
                  key={circle.id}
                  className={outline ? 'circles__ring circles__ring--outline' : 'circles__ring'}
                  cx={mark.cx}
                  cy={mark.cy}
                  r={mark.r}
                />
              ),
            )}
          </g>
          <g className="circles__wash">
            {marked.map(({ circle, outline, mark }) =>
              outline || mark === undefined ? null : (
                <circle key={circle.id} cx={mark.cx} cy={mark.cy} r={mark.r} />
              ),
            )}
          </g>
          <g className="circles__names">
            {marked.map(({ circle, mark }) =>
              mark === undefined ? null : (
                <text key={circle.id} x={mark.name.x} y={mark.name.y} fontSize={mark.name.size}>
                  {circle.name}
                </text>
              ),
            )}
          </g>
          <g className="circles__lenses">
            {lenses.map((lens) => {
              const mark = LENS_MARKS[lens.at]
              if (mark === undefined) return null
              return (
                <g key={lens.todoId}>
                  <text x={mark.x} y={mark.y} textAnchor="middle">
                    {lens.title}
                  </text>
                  <text x={mark.x} y={mark.y + LENS_LINE_GAP} textAnchor="middle">
                    {lens.note}
                  </text>
                </g>
              )
            })}
          </g>
          <g>
            {marked.map(({ circle, mark }) =>
              mark === undefined ? null : (
                <g key={circle.id}>
                  {peopleLabel(circle.people) !== null && (
                    <text className="circles__people" x={mark.people.x} y={mark.people.y}>
                      {peopleLabel(circle.people)}
                    </text>
                  )}
                  {providersLabel(circle.providers) !== null && (
                    <text
                      className="circles__providers"
                      x={mark.people.x}
                      y={mark.people.y + PEOPLE_LINE_GAP}
                    >
                      {providersLabel(circle.providers)}
                    </text>
                  )}
                </g>
              ),
            )}
          </g>
        </svg>
        <figcaption className="sr-only">
          Your Circles, and the Overlaps written where they meet.
          <ul>
            {seated.map(({ circle }) => (
              <li key={circle.id}>
                {[
                  circle.name,
                  circle.side,
                  peopleLabel(circle.people),
                  providersLabel(circle.providers),
                ]
                  .filter((part) => part !== null)
                  .join(' · ')}
              </li>
            ))}
            {lenses.map((lens) => {
              const [one, two] = LENS_SEATS[lens.at] ?? []
              return (
                <li key={lens.todoId}>
                  Where {nameOfSeat.get(one ?? -1)} and {nameOfSeat.get(two ?? -1)} meet:{' '}
                  {lens.title} · {lens.note}
                </li>
              )
            })}
          </ul>
        </figcaption>
      </Blueprint>
      {unseated.length > 0 && (
        <p className="circles__unseated">
          Not in the picture: {unseated.map((circle) => circle.name).join(', ')}.
        </p>
      )}
    </>
  )
}
