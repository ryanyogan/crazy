import type { ComponentPropsWithoutRef } from 'react'

/**
 * Industry's table: a hairline rule under each row and a small condensed
 * heading over each column. It is a real `<table>`, so a screen reader reads a
 * cell with the column it is under, and every screen that lists rows uses it.
 */
export function Table({ className, ...rest }: ComponentPropsWithoutRef<'table'>) {
  return <table className={className ? `table ${className}` : 'table'} {...rest} />
}
