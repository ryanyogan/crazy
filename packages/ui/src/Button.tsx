import type { ComponentPropsWithoutRef } from 'react'

type ButtonProps = {
  /** Industry's button treatments. `plain` is the bare frame, for a button dressed by its surroundings. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'plain'
} & ComponentPropsWithoutRef<'button'>

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', variant !== 'plain' && `btn-${variant}`, className]
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...rest} />
}
