import { type WeekDayView, describeDay } from '@crazy/shared'

/** A share of the tallest bar on the screen, as a height. */
const height = (share: number) => `${(share * 100).toFixed(2)}%`

/**
 * One day of the week: what it is called, three bars for what it holds, the
 * line Crazy writes under them and the few words it gives each thing. The bars
 * count Todos and meetings, all seven days to one scale, so the week can be
 * read across at a glance.
 */
function Day({ day }: { day: WeekDayView }) {
  return (
    // Frame 1c draws every day the same, today included, so today is said
    // rather than drawn (docs/BRIEF.md, "Derived layouts").
    <li className="weekday" aria-current={day.isToday ? 'date' : undefined}>
      <h3 className="weekday__head">
        <span className="weekday__name">{day.name}</span>
        <span className="weekday__date">{day.date}</span>
      </h3>
      <div className="weekday__bars" aria-hidden="true">
        <span
          className="weekday__bar weekday__bar--done"
          style={{ height: height(day.share.done) }}
        />
        <span
          className="weekday__bar weekday__bar--planned"
          style={{ height: height(day.share.planned) }}
        />
        <span
          className="weekday__bar weekday__bar--meetings"
          style={{ height: height(day.share.meetings) }}
        />
      </div>
      {/* The bars in words, for anyone who cannot see how tall they are. */}
      <span className="sr-only">{describeDay(day)}</span>
      {day.caption && <p className="weekday__caption">{day.caption}</p>}
      {day.lines.map((line) => (
        <p key={line.id} className="weekday__line">
          {line.text}
        </p>
      ))}
    </li>
  )
}

/** The week's shape: seven days, and what the three bars in each of them mean. */
export function WeekDays({ days }: { days: WeekDayView[] }) {
  return (
    <>
      <section className="week__days" aria-labelledby="days-title">
        <h2 id="days-title" className="sr-only">
          The week, day by day
        </h2>
        <ol className="week__cards">
          {days.map((day) => (
            <Day key={day.day} day={day} />
          ))}
        </ol>
      </section>
      <p className="week__legend">
        <span>
          <span className="week__swatch week__swatch--done" />
          done
        </span>
        <span>
          <span className="week__swatch week__swatch--planned" />
          planned
        </span>
        <span>
          <span className="week__swatch week__swatch--meetings" />
          meetings
        </span>
      </p>
    </>
  )
}
