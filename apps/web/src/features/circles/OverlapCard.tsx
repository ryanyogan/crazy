import { type ViewOverlap, overlapMeta } from '@crazy/shared'
import { Blueprint, Tag } from '@crazy/ui'

/**
 * One Overlap: the Circles the Todo is matched to, what it is, and whatever
 * Crazy has written about it — a match can exist before any wording does, and
 * then the Todo's own words are all the card says. Nothing here is a control:
 * an Overlap is read off the matches, and no screen corrects those yet.
 */
export function OverlapCard({ overlap }: { overlap: ViewOverlap }) {
  const meta = overlapMeta(overlap)

  return (
    <Blueprint as="li" className="card circles__overlap">
      <div className="circles__tags">
        {overlap.circles.map((circle) => (
          <Tag key={circle.id} tone="accent" className="circles__tag">
            {circle.name}
          </Tag>
        ))}
      </div>
      <div className="card-title">{overlap.title}</div>
      {overlap.text !== null && <p className="card-body">{overlap.text}</p>}
      {meta !== null && <div className="card-meta">{meta}</div>}
    </Blueprint>
  )
}
