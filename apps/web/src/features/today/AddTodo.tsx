import { Button, NotWired } from '@crazy/ui'

/** Where a Todo is typed in. Drawn now; adding arrives with ticket 07. */
export function AddTodo() {
  return (
    <form className="addtodo" onSubmit={(event) => event.preventDefault()}>
      <NotWired>
        <input
          className="input"
          placeholder="Add a todo for today… (⌘K)"
          aria-label="Add a Todo for today"
          readOnly
        />
      </NotWired>
      <NotWired>
        <Button type="submit">Add</Button>
      </NotWired>
    </form>
  )
}
