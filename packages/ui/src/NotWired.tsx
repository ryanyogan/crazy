import { type MouseEvent, type ReactElement, cloneElement, useId } from 'react'

interface NotWiredProps {
  /** What assistive technology is told. */
  why?: string
  children: ReactElement<{
    'aria-disabled'?: boolean
    'aria-describedby'?: string
    'data-not-wired'?: string
    onClick?: (event: MouseEvent) => void
  }>
}

/**
 * Wraps a control that is drawn but does nothing yet. The control keeps its
 * drawn look and its place in the tab order, does nothing when pressed, and is
 * announced as unavailable with the reason. Nothing is faked.
 */
export function NotWired({ why = 'Not available yet', children }: NotWiredProps) {
  const id = useId()
  return (
    <>
      {cloneElement(children, {
        'aria-disabled': true,
        'aria-describedby': id,
        'data-not-wired': '',
        onClick: (event) => event.preventDefault(),
      })}
      <span id={id} hidden>
        {why}
      </span>
    </>
  )
}
