import { METRIC_TABS, METRIC_TAB_LABELS, MONEY_NOT_WIRED, type MetricTab } from '@crazy/shared'
import { NotWired } from '@crazy/ui'

interface TabPickerProps {
  open: MetricTab
  onPick: (tab: MetricTab) => void
}

/**
 * Which side of Metrics is being read (frame 4a). A radio group, like the range
 * beside it, so the arrow keys move through it and each option keeps the accent
 * focus ring. The chosen tab is read back off the URL, so the two can never
 * disagree.
 *
 * Money is drawn because the frame draws it, and does nothing, because there is
 * nothing behind it: it keeps its place in the tab order, is announced as
 * unavailable with the reason, and never reaches the URL. Nothing is faked.
 */
export function TabPicker({ open, onPick }: TabPickerProps) {
  return (
    <span className="seg metrics__tabs" role="radiogroup" aria-label="Which metrics to show">
      {METRIC_TABS.map((tab) => {
        const input = (
          <input
            type="radio"
            name="metrics-tab"
            value={tab}
            checked={tab === open}
            onChange={() => onPick(tab)}
          />
        )
        return (
          <label key={tab} className={tab === 'money' ? 'seg-opt seg-opt--off' : 'seg-opt'}>
            {tab === 'money' ? <NotWired why={MONEY_NOT_WIRED}>{input}</NotWired> : input}
            {METRIC_TAB_LABELS[tab]}
          </label>
        )
      })}
    </span>
  )
}
