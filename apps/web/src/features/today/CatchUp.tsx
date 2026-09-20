import { type CatchUp as CatchUpModel, SOURCE_KINDS, formatAge } from '@crazy/shared'
import { SourceChip, Tag } from '@crazy/ui'
import { Mentions } from './Mentions'

/**
 * What arrived and what the Rollover did, so that nothing surprises her later
 * in the day. The Mentions are the card frame 1a draws, unchanged, with the
 * way to add each one as a Todo; under it go the Promises she made and the
 * Waiting-on that came in since yesterday's local midnight, and what the last
 * Rollover carried over and sent back — by name, because "three carried over"
 * is a number and "the Q4 draft, again" is a fact.
 */
export function CatchUp({ catchUp, now }: { catchUp: CatchUpModel; now: Date }) {
  const { promises, owed, carriedOver, sentBack } = catchUp
  return (
    <div className="catchup">
      {/* Frame 1a's card, unchanged: every Mention in the order it arrived,
          the ones already added saying so rather than disappearing. */}
      <Mentions mentions={catchUp.mentions} now={now} />

      {(promises.length > 0 || owed.length > 0) && (
        <div className="catchup__signals">
          {promises.length > 0 && (
            <section aria-labelledby="catchup-promises">
              <h3 id="catchup-promises" className="card-kicker catchup__kicker">
                You said you'd
              </h3>
              <ul className="catchup__list">
                {promises.map((signal) => (
                  <li key={signal.id}>
                    <SourceChip source={SOURCE_KINDS[signal.source.kind]} />
                    <span className="catchup__what">
                      {signal.text} <strong>{signal.who}</strong>
                    </span>
                    <span className="catchup__age">
                      {formatAge(new Date(signal.at), now)}
                      <span className="sr-only"> ago</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {owed.length > 0 && (
            <section aria-labelledby="catchup-owed">
              <h3 id="catchup-owed" className="card-kicker catchup__kicker">
                Waiting on
              </h3>
              <ul className="catchup__list">
                {owed.map((signal) => (
                  <li key={signal.id}>
                    <SourceChip source={SOURCE_KINDS[signal.source.kind]} />
                    <span className="catchup__what">
                      <strong>{signal.who}</strong> {signal.text}
                    </span>
                    <span className="catchup__age">
                      {formatAge(new Date(signal.at), now)}
                      <span className="sr-only"> ago</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {(carriedOver.length > 0 || sentBack.length > 0) && (
        <section className="catchup__rollover" aria-labelledby="catchup-rollover">
          <h3 id="catchup-rollover" className="card-kicker catchup__kicker">
            At the Rollover
          </h3>
          <ul className="catchup__list catchup__list--plain">
            {carriedOver.map((todo) => (
              <li key={todo.id}>
                <Tag tone="accent">Carried over</Tag>
                <span className="catchup__what">{todo.title}</span>
                <span className="catchup__age">
                  {todo.carryCount} {todo.carryCount === 1 ? 'day' : 'days'}
                </span>
              </li>
            ))}
            {sentBack.map((todo) => (
              <li key={todo.id}>
                <Tag>Sent back</Tag>
                <span className="catchup__what">{todo.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
