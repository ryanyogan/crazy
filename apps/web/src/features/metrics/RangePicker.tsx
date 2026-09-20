import { METRIC_RANGES, METRIC_RANGE_LABELS, type MetricRange } from '@crazy/shared'

interface RangePickerProps {
  range: MetricRange
  onPick: (range: MetricRange) => void
}

/**
 * How far back the screen looks. A radio group, so the arrow keys move through
 * it the way a segmented control should and each option carries the accent
 * focus ring Industry gives it. Picking one puts the range in the URL, which is
 * what changes the screen: the checked option is read back off the URL, so the
 * two can never disagree.
 */
export function RangePicker({ range, onPick }: RangePickerProps) {
  return (
    <span className="seg metrics__range" role="radiogroup" aria-label="How far back to look">
      {METRIC_RANGES.map((each) => (
        <label key={each} className="seg-opt">
          <input
            type="radio"
            name="range"
            value={each}
            checked={each === range}
            onChange={() => onPick(each)}
          />
          {METRIC_RANGE_LABELS[each]}
        </label>
      ))}
    </span>
  )
}
