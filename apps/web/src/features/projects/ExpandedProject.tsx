import { SOURCE_KINDS, type ViewProject } from '@crazy/shared'
import { Blueprint, SourceChip } from '@crazy/ui'

/**
 * A Project opened up: what it has on today, and the head of its backlog with
 * how long each has waited. The squares are marks, not controls — a Todo is
 * ticked here and nowhere else, so nothing on this card pretends to be wired.
 */
export function ExpandedProject({ project }: { project: ViewProject }) {
  const { backlog, todayTodos } = project

  return (
    <Blueprint as="section" className="card projects__expanded" aria-labelledby="expanded-title">
      <h2 id="expanded-title" className="card-kicker">
        {project.row.name} · expanded
      </h2>
      <div className="projects__columns">
        <div>
          <h3 className="projects__column-title">{"Today's children"}</h3>
          {todayTodos.length === 0 ? (
            <p className="projects__none">Nothing from this Project is in today.</p>
          ) : (
            <ul className="projects__children">
              {todayTodos.map((todo) => {
                const done = todo.state === 'done'
                return (
                  <li
                    key={todo.id}
                    className={done ? 'projects__child projects__child--done' : 'projects__child'}
                  >
                    <span
                      className={done ? 'projects__mark projects__mark--done' : 'projects__mark'}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{done ? 'Done: ' : 'Not done: '}</span>
                    {done ? <s>{todo.title}</s> : todo.title}
                    {todo.source ? <SourceChip source={SOURCE_KINDS[todo.source.kind]} /> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div>
          <h3 className="projects__column-title">Backlog · {backlog.count}</h3>
          {backlog.head.length === 0 ? (
            <p className="projects__none">Nothing is waiting.</p>
          ) : (
            <ul className="projects__backlog">
              {backlog.head.map(({ todo, age }) => (
                <li key={todo.id}>
                  {todo.title} <span className="projects__age">· {age}</span>
                  <span className="sr-only"> since it was last touched</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Blueprint>
  )
}
