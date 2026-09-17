import { createFileRoute } from '@tanstack/react-router'
import { MoreScreen } from '#/features/shell/MoreScreen'

// The phone tab bar's fourth tab: every destination the bar leaves out.
export const Route = createFileRoute('/_app/more')({
  component: MoreScreen,
})
