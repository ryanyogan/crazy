import { type MetricRange, type MetricTab } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { shellQuery } from '#/lib/queries'
import { RangePicker } from './RangePicker'
import { TabPicker } from './TabPicker'
import { TimeTab } from './TimeTab'
import { TodosTab } from './TodosTab'

const route = getRouteApi('/_app/metrics')

/**
 * The Metrics screen. Frame 1f is the Todos tab, which every user has; frame 4a
 * adds the Time tab beside it for a user who bills for their time, and a Money
 * tab that is drawn and not wired. With the Billing module off there is one
 * side to this screen and no tab control at all.
 *
 * Both the tab and the range are the URL's. Picking either navigates, the
 * route's loader reads what that asks for and the screen reads it back — so
 * the screen never holds a state of its own that the address bar could
 * disagree with, and the browser's back button works on it like any other link.
 */
export function MetricsScreen() {
  const { tab, range } = route.useSearch()
  const navigate = route.useNavigate()
  const { data: shell } = useSuspenseQuery(shellQuery)
  // The Time tab is part of the Billing module; a link to it with the module
  // off opens the screen every user has rather than failing.
  const open: MetricTab = shell.billing ? tab : 'todos'

  const pickTab = (tab: MetricTab) => {
    if (tab === 'money') return
    void navigate({ search: { tab, range } })
  }
  const pickRange = (range: MetricRange) => {
    void navigate({ search: { tab: open, range } })
  }

  return (
    <div className={open === 'time' ? 'screen metrics metrics--time' : 'screen metrics'}>
      <header className="metrics__head">
        <h1 className="screen__title">Metrics</h1>
        <div className="metrics__controls">
          {shell.billing ? <TabPicker open={open} onPick={pickTab} /> : null}
          <RangePicker range={range} onPick={pickRange} />
        </div>
      </header>

      {open === 'time' ? <TimeTab range={range} /> : <TodosTab range={range} />}
    </div>
  )
}
