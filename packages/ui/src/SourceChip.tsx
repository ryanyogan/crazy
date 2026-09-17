import { Tag } from './Tag'

interface SourceChipProps {
  /** The Provider item's kind, as a chip and in words: "LN" and "Linear". Null for none. */
  source: { chip: string; name: string } | null
}

/**
 * The tiny condensed tag that says where something came from. With no Source
 * it keeps its place in the row as a dash, which assistive technology skips.
 */
export function SourceChip({ source }: SourceChipProps) {
  if (!source) {
    return (
      <Tag className="source-chip" aria-hidden="true">
        —
      </Tag>
    )
  }
  return (
    <Tag className="source-chip" title={source.name}>
      <span aria-hidden="true">{source.chip}</span>
      <span className="sr-only">From {source.name}</span>
    </Tag>
  )
}
