import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { Blueprint } from './Blueprint'

interface StatTileProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** What the figure is called, in the card's kicker: "Completion". */
  label: ReactNode
  /** The figure itself, large: "82%". */
  value: ReactNode
  /** The line under it, where there is one: "+6 vs last 30d". */
  note?: ReactNode
  /** The element the tile is; a list of figures wants list items. */
  as?: ElementType
}

/**
 * One figure, said once: a blueprint card holding what it is called, the figure
 * at a size you can read across a room, and the line underneath that gives it
 * direction. The three read in that order to assistive technology, so the tile
 * needs nothing said about it beyond its own words.
 */
export function StatTile({ label, value, note, as = 'div', className, ...rest }: StatTileProps) {
  return (
    <Blueprint as={as} className={className ? `card stat ${className}` : 'card stat'} {...rest}>
      <div className="card-kicker stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {note === undefined || note === null ? null : <div className="stat__note">{note}</div>}
    </Blueprint>
  )
}
