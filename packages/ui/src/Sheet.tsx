import { type ReactNode, useEffect, useRef } from 'react'

interface SheetProps {
  open: boolean
  /** Called when the sheet asks to close: escape, a tap on the scrim, or its own control. */
  onClose: () => void
  /** What the sheet is called, for assistive technology. */
  label: string
  className?: string
  children: ReactNode
}

/**
 * A modal sheet that rises from the bottom of a phone's screen (frame 3b). It
 * is the native `<dialog>`, opened modally, so the browser itself dims what is
 * behind it, holds focus inside while it is open, and hands focus back to
 * whatever opened it when it closes. Escape and a tap on the scrim close it.
 *
 * Whether it is open is the caller's state, not the element's: the effect only
 * makes the element agree, so a sheet closed by escape leaves the caller
 * knowing it closed.
 */
export function Sheet({ open, onClose, label, className, children }: SheetProps) {
  const sheet = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = sheet.current
    if (!element) return

    // Escape: the browser would close the element behind the caller's back, so
    // it is stopped and the caller closes it, which closes the element.
    const cancelled = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    // A tap on the scrim lands on the dialog itself, outside its box. A click
    // with no pointer behind it (`detail` 0) is a keyboard press, not a tap.
    const pressed = (event: MouseEvent) => {
      if (event.detail === 0) return
      const box = element.getBoundingClientRect()
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      if (!inside) onClose()
    }
    // What had focus last while the sheet was closed is what opened it, and is
    // where focus goes back to. It is noted as it happens because what the
    // sheet holds takes the focus the moment it is there, before the element
    // is shown; and because focus on a control the sheet then removes is focus
    // on nothing.
    const noted = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!element.open && target !== null && !element.contains(target)) opener.current = target
    }
    element.addEventListener('cancel', cancelled)
    element.addEventListener('click', pressed)
    document.addEventListener('focusin', noted)
    return () => {
      element.removeEventListener('cancel', cancelled)
      element.removeEventListener('click', pressed)
      document.removeEventListener('focusin', noted)
    }
  }, [onClose])

  useEffect(() => {
    const element = sheet.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) {
      element.close()
      opener.current?.focus()
    }
  }, [open])

  return (
    <dialog
      ref={sheet}
      className={className ? `sheet ${className}` : 'sheet'}
      aria-modal="true"
      aria-label={label}
    >
      {open && children}
    </dialog>
  )
}
