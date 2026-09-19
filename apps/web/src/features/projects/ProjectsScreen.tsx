import {
  PROJECT_FILTERS,
  PROJECT_FILTER_LABELS,
  type ProjectFilter,
  viewProjects,
} from '@crazy/shared'
import { SegmentedControl } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { projectsQuery } from '#/lib/queries'
import { ExpandedProject } from './ExpandedProject'
import { Promises } from './Promises'
import { ProjectsTable } from './ProjectsTable'
import { WaitingOn } from './WaitingOn'

const FILTER_OPTIONS = PROJECT_FILTERS.map((value) => ({
  value,
  label: PROJECT_FILTER_LABELS[value],
}))

/**
 * The Projects screen, frame 1d. One DOM serves both widths: on a phone the two
 * columns fall into one, the table first and the Signals under it.
 *
 * The frame draws a Project opened up, so the first is open until the user
 * chooses another or closes it.
 */
export function ProjectsScreen() {
  const { data } = useSuspenseQuery(projectsQuery)
  const [filter, setFilter] = useState<ProjectFilter>('all')
  /** Undefined until the user has chosen; null once they have closed them all. */
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)

  const now = new Date(data.now)
  const view = viewProjects(data, now, filter)

  const first = view.projects[0]?.row.id ?? null
  const expandedId =
    chosen === undefined
      ? first
      : // A Project the filter has taken off the screen is no longer open.
        view.projects.some((project) => project.row.id === chosen)
        ? chosen
        : null
  const expanded = view.projects.find((project) => project.row.id === expandedId)

  return (
    <div className="screen projects">
      <section className="projects__main" aria-labelledby="projects-title">
        <div className="projects__head">
          <h1 id="projects-title" className="screen__title">
            Projects
          </h1>
          <SegmentedControl
            label="Which Side of your life to show"
            value={filter}
            options={FILTER_OPTIONS}
            onChange={setFilter}
          />
        </div>
        {view.projects.length === 0 ? (
          <p className="projects__none">
            {filter === 'all'
              ? 'You have no Projects yet.'
              : `Nothing on your ${filter} Side is a Project yet.`}
          </p>
        ) : (
          <ProjectsTable
            projects={view.projects}
            expanded={expandedId}
            onExpand={(projectId) => setChosen(expandedId === projectId ? null : projectId)}
          />
        )}
        {expanded ? <ExpandedProject project={expanded} /> : null}
      </section>

      <aside className="projects__aside">
        <Promises promises={view.promises} unadded={view.unaddedPromises} now={now} />
        <WaitingOn waitingOn={view.waitingOn} now={now} />
        <p className="projects__lifecycle">{view.lifecycle}</p>
      </aside>
    </div>
  )
}
