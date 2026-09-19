import type { MetricRange, MetricsView } from '@crazy/shared'

interface RangePickerProps {
  ranges: MetricsView['ranges']
  onPick: (range: MetricRange) => void
}

/**
 * How far back the screen looks. A radio group, so the arrow keys move through
 * it the way a segmented control should and each option carries the accent
 * focus ring Industry gives it. Picking one puts the range in the URL, which is
 * what changes the screen: the checked option is read back off the URL, so the
 * two can never disagree.
 */
export function RangePicker({ ranges, onPick }: RangePickerProps) {
  return (
    <span className="seg metrics__range" role="radiogroup" aria-label="How far back to look">
      {ranges.map(({ range, label, selected }) => (
        <label key={range} className="seg-opt">
          <input
            type="radio"
            name="range"
            value={range}
            checked={selected}
            onChange={() => onPick(range)}
          />
          {label}
        </label>
      ))}
    </span>
  )
}
