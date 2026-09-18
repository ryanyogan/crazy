import { Button } from '@crazy/ui'
import { useEffect, useRef, useState } from 'react'
import { useCommand } from '#/lib/useCommand'

/** Somewhere the user is already typing, so ⌘K would take the caret from them. */
const typingIn = (node: EventTarget | null): boolean =>
  node instanceof HTMLElement &&
  (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName))

/** Capture a One-off in today's stack. Keep the draft until it is saved. */
export function AddTodo() {
  const [title, setTitle] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const command = useCommand()

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if (event.repeat || !(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'k') return
      if (event.target !== input.current && typingIn(event.target)) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', focus)
    return () => window.removeEventListener('keydown', focus)
  }, [])

  return (
    <form
      className="addtodo"
      onSubmit={(event) => {
        event.preventDefault()
        if (command.isPending) return
        if (!title.trim()) {
          // `required` catches an empty field; spaces get past it, so say why here.
          input.current?.setCustomValidity('Give the Todo a few words.')
          input.current?.reportValidity()
          return
        }
        const draft = title
        command.mutate(
          { type: 'todo.add', id: crypto.randomUUID(), title: title.trim() },
          {
            onSuccess: () => {
              setTitle((current) => (current === draft ? '' : current))
              input.current?.focus()
            },
          },
        )
      }}
    >
      <input
        ref={input}
        className="input"
        placeholder="Add a todo for today… (⌘K)"
        aria-label="Add a Todo for today"
        value={title}
        onChange={(event) => {
          event.target.setCustomValidity('')
          setTitle(event.target.value)
        }}
        maxLength={500}
        required
      />
      <Button type="submit" disabled={command.isPending}>
        Add
      </Button>
    </form>
  )
}
