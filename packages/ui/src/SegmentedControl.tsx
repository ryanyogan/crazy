import { useId } from 'react'

interface SegmentedControlProps<T extends string> {
  /** What the group is for, said to assistive technology: "Which Side to show". */
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

/**
 * Industry's segmented control: one of a few choices, the chosen one filled
 * with the accent. It is built from real radio buttons, so the arrow keys move
 * between the choices, the accent focus ring follows, and a screen reader
 * announces the group and which of them is chosen.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()
  return (
    <span className={className ? `seg ${className}` : 'seg'} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="seg-opt">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </span>
  )
}
