import type { ViewProject } from '@crazy/shared'
import { Table, Tag } from '@crazy/ui'

/** How far along one Project is, drawn and said. */
function Progress({ percent }: { percent: number }) {
  return (
    <div className="projects__progress">
      <span className="projects__bar" aria-hidden="true">
        <span className="projects__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="projects__percent">{percent}%</span>
    </div>
  )
}

interface ProjectsTableProps {
  projects: ViewProject[]
  /** The Project whose card is open, if any. */
  expanded: string | null
  onExpand: (projectId: string) => void
}

/**
 * The long work, one row each: its Circle and what is still open, its status,
 * the progress counted from its Todos, its next milestone and what it has on
 * today. Pressing a row opens that Project's card underneath the table.
 */
export function ProjectsTable({ projects, expanded, onExpand }: ProjectsTableProps) {
  return (
    <Table className="projects__table">
      <thead>
        <tr>
          <th scope="col">Project</th>
          <th scope="col">Status</th>
          <th scope="col" className="projects__progress-column">
            Progress
          </th>
          <th scope="col">Next milestone</th>
          <th scope="col">Today</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.row.id}>
            <td>
              <button
                type="button"
                className="projects__name"
                aria-expanded={expanded === project.row.id}
                onClick={() => onExpand(project.row.id)}
              >
                {project.row.name}
              </button>
              <div className="projects__meta">
                {project.circle} · {project.open}
              </div>
            </td>
            <td>
              <Tag tone={project.status.tone}>{project.status.label}</Tag>
            </td>
            <td>
              <Progress percent={project.progress} />
            </td>
            <td className="projects__milestone">{project.milestone}</td>
            <td className="projects__today">{project.today}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
