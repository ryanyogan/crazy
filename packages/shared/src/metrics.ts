import { z } from 'zod'
import { addDays } from './clock'
import { PROVIDER_LABELS, type Provider } from './todo'
import { formatHourCount } from './week'

// The rules of the Metrics screen that need no database: what a range covers,
// which figures Crazy models and which the screen counts for itself, and how
// the three charts are drawn. Nothing here reads the clock.
//
// Two kinds of figure sit on this screen, and the difference is the point:
//
//  - **Counted.** The backlog's ageing and where the range's Todos came from
//    are counted from Todos when the screen is read, by indexed queries. They
//    move as the user uses the app and are never stored.
//  - **Modelled.** The six headline figures, the bars by hour of day, the
//    thirty-day strip and the commentary are Crazy's reading of the same data,
//    written for one range on one day and stored where generated text lives —
//    the same standing as the Brief. A figure the screen can count is never
//    stored, and a day Crazy has not modelled shows no modelled figure.

/** How far back the screen looks. The URL carries one of these. */
export const METRIC_RANGES = ['week', '30d', 'quarter'] as const
export const metricRange = z.enum(METRIC_RANGES)
export type MetricRange = z.infer<typeof metricRange>

/** The range frame 1f draws selected, and what a link with no range means. */
export const DEFAULT_METRIC_RANGE = '30d' satisfies MetricRange

/** What the segmented control calls each range. */
export const METRIC_RANGE_LABELS: Record<MetricRange, string> = {
  week: 'Week',
  '30d': '30 days',
  quarter: 'Quarter',
}

/** How many days each range covers, today included. */
export const METRIC_RANGE_DAYS: Record<MetricRange, number> = { week: 7, '30d': 30, quarter: 90 }

/** The first local day of `range`, counting back from `day` and including it. */
export function metricRangeFrom(range: MetricRange, day: string): string {
  return addDays(day, -(METRIC_RANGE_DAYS[range] - 1))
}

/** What a stored modelled row is: one figure, one bar, or one line of prose. */
export const METRIC_KINDS = ['headline', 'series', 'note'] as const
export const metricKind = z.enum(METRIC_KINDS)
export type MetricKind = z.infer<typeof metricKind>

/** The six headline figures, in the order frame 1f lays them out. */
export const METRIC_HEADLINES = {
  completion: 'Completion',
  carry_over: 'Carry-over',
  focus_hours: 'Focus hours',
  median_age: 'Median item age',
  take_on_streak: 'Take-on streak',
  response_debt: 'Response debt',
} as const
export type MetricHeadline = keyof typeof METRIC_HEADLINES

/** The two modelled series: hours by hour of day, and the thirty-day strip. */
export const METRIC_SERIES = ['focus_by_hour', 'completion_days'] as const

/** The lines Crazy writes under each card, beside the figures it counts. */
export const METRIC_NOTES = [
  'focus_by_hour',
  'backlog_ageing',
  'todo_sources',
  'completion_days',
] as const

/** How many days the strip under the screen shows, whatever range is chosen. */
export const COMPLETION_DAYS = 30

/**
 * How long a Todo has sat in the backlog untouched, in the bands frame 1f
 * draws. The last band is grey because those Todos are the ones about to
 * archive; the others darken with how recent they are.
 */
export const METRIC_AGE_BUCKETS = [
  { id: 'under_7', label: '< 7d', from: 0, until: 7, tone: 'recent' },
  { id: 'to_30', label: '7–30d', from: 7, until: 30, tone: 'settling' },
  { id: 'to_60', label: '30–60d', from: 30, until: 60, tone: 'old' },
  { id: 'to_90', label: '60–90d', from: 60, until: 90, tone: 'archiving' },
] as const
export type MetricAgeBucket = (typeof METRIC_AGE_BUCKETS)[number]['id']

/** How dark a day of the strip is drawn: 0 is empty, 4 is a day finished. */
export const COMPLETION_LEVELS = 4

/** One headline figure as Crazy modelled it for a range. */
export interface MetricHeadlineFigure {
  figure: MetricHeadline
  /** What it is called: "Completion". */
  label: string
  /** The figure as it reads: "82%", "1.3d". */
  value: string
  /** The line under it: "+6 vs last 30d". */
  note: string | null
}

/** One bar of the hours-by-hour-of-day chart. */
export interface MetricHour {
  /** The hour of the day, as the axis labels it: "10". */
  label: string
  hours: number
}

/** One day of the thirty-day strip: the share of that day's plan completed. */
export interface MetricDay {
  day: string
  share: number
}

/** Everything Crazy modelled for one range on one day. */
export interface Modelled {
  headlines: MetricHeadlineFigure[]
  focusByHour: MetricHour[]
  completionDays: MetricDay[]
  /** The line under each card, where Crazy wrote one. */
  notes: Partial<Record<(typeof METRIC_NOTES)[number], string>>
}

/** The backlog as it stands, counted: never a range, always now. */
export interface BacklogAgeing {
  total: number
  buckets: { id: MetricAgeBucket; label: string; count: number }[]
}

/** Where the Todos of a range came from, counted. Null is what the user typed. */
export interface TodoSource {
  provider: Provider | null
  count: number
}

/** What the Metrics screen holds, as one read of D1 leaves it. */
export interface Metrics {
  range: MetricRange
  /** The user's local day it was read on, and the range's first day. */
  day: string
  from: string
  /** Null when Crazy has not modelled this range today. */
  modelled: Modelled | null
  backlog: BacklogAgeing
  sources: TodoSource[]
}

/** A bar with the share of the largest one on its chart, as a whole percent. */
export interface Bar {
  label: string
  /** What the figure reads beside the bar. */
  value: string
  /** The bar's length, "64%", rounded as the frame rounds it. */
  length: string
  /** Whether this is the chart's largest bar; the peak is drawn solid. */
  peak: boolean
}

export interface MetricsView {
  /** The three ranges, in the order the control lays them out. */
  ranges: { range: MetricRange; label: string; selected: boolean }[]
  /** "Backlog ageing · 34 items". */
  backlogTitle: string
  focusBars: (Bar & { hours: number })[]
  ageingBars: (Bar & { id: MetricAgeBucket; tone: string })[]
  sourceBars: (Bar & { chip: string; name: string })[]
  /** The thirty days, oldest first, each with how dark it is drawn. */
  heat: { day: string; share: number; level: number }[]
  /** What each chart says to someone who cannot see it. */
  described: { focus: string; ageing: string; sources: string; heat: string }
}

/** A share of the largest bar, rounded to the whole percent the frame draws. */
function length(value: number, largest: number): string {
  return `${largest <= 0 ? 0 : Math.round((value / largest) * 100)}%`
}

/** "Sep 17": how a day of the strip is named in the sentence that reads it out. */
function dayName(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${day}T00:00:00Z`))
}

/** Everything the Metrics screen derives from one read. */
export function viewMetrics(metrics: Metrics): MetricsView {
  const focus = metrics.modelled?.focusByHour ?? []
  const focusPeak = Math.max(0, ...focus.map((hour) => hour.hours))
  const focusBars = focus.map((hour) => ({
    label: hour.label,
    hours: hour.hours,
    value: `${formatHourCount(hour.hours)}h`,
    length: length(hour.hours, focusPeak),
    peak: hour.hours === focusPeak && focusPeak > 0,
  }))

  const ageingLargest = Math.max(0, ...metrics.backlog.buckets.map((bucket) => bucket.count))
  const ageingBars = metrics.backlog.buckets.map((bucket) => ({
    id: bucket.id,
    tone: METRIC_AGE_BUCKETS.find((each) => each.id === bucket.id)?.tone ?? 'recent',
    label: bucket.label,
    value: String(bucket.count),
    length: length(bucket.count, ageingLargest),
    peak: false,
  }))

  // The Providers first, the largest first; what the user typed themselves last.
  const ordered = [...metrics.sources]
    .filter((source) => source.count > 0)
    .sort((a, b) => {
      if ((a.provider === null) !== (b.provider === null)) return a.provider === null ? 1 : -1
      return b.count - a.count
    })
  const sourcesLargest = Math.max(0, ...ordered.map((source) => source.count))
  const sourceBars = ordered.map((source) => {
    const provider = source.provider === null ? null : PROVIDER_LABELS[source.provider]
    return {
      chip: provider?.chip ?? 'You',
      name: provider?.name ?? 'Typed in',
      label: provider?.name ?? 'Typed in',
      value: String(source.count),
      length: length(source.count, sourcesLargest),
      peak: false,
    }
  })

  const days = metrics.modelled?.completionDays ?? []

  return {
    ranges: METRIC_RANGES.map((range) => ({
      range,
      label: METRIC_RANGE_LABELS[range],
      selected: range === metrics.range,
    })),
    backlogTitle: `Backlog ageing · ${metrics.backlog.total} ${
      metrics.backlog.total === 1 ? 'item' : 'items'
    }`,
    focusBars,
    ageingBars,
    sourceBars,
    heat: days.map((day) => ({
      ...day,
      // Nothing finished is an empty square; anything else darkens in quarters.
      level:
        day.share <= 0 ? 0 : Math.min(COMPLETION_LEVELS, Math.ceil(day.share * COMPLETION_LEVELS)),
    })),
    described: {
      focus:
        focusBars.length === 0
          ? 'Crazy has not modelled this range today.'
          : `Hours of finished work by the hour of day they were finished in: ${focusBars
              .map((bar) => `${bar.label}:00, ${bar.value}`)
              .join('; ')}.`,
      ageing: `${metrics.backlog.total} in the backlog: ${ageingBars
        .map((bar) => `${bar.label}, ${bar.value}`)
        .join('; ')}.`,
      sources:
        sourceBars.length === 0
          ? 'No Todo arrived in this range.'
          : sourceBars.map((bar) => `${bar.name}, ${bar.value}`).join('; ') + '.',
      heat:
        days.length === 0
          ? 'Crazy has not modelled this range today.'
          : `How much of each day's plan was completed, oldest first: ${days
              .map((day) => `${dayName(day.day)}, ${Math.round(day.share * 100)}%`)
              .join('; ')}.`,
    },
  }
}
