/** A destination that resolves but has nothing drawn in it yet. */
export function EmptyScreen({ title }: { title: string }) {
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{title}</h1>
        <p className="text-muted">Nothing here yet.</p>
      </header>
    </div>
  )
}
