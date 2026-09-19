import { createFileRoute } from '@tanstack/react-router'
import { ProjectsScreen } from '#/features/projects/ProjectsScreen'
import { projectsQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/projects')({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  component: ProjectsScreen,
})
