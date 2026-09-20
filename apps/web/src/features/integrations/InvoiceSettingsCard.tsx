import {
  AUTO_DRAFT_NOTE,
  CADENCE_WORDS,
  CLIENT_CADENCES,
  type ClientCadence,
  type ClientInvoicing,
  type InvoicingChange,
  SEND_WITHOUT_REVIEW_NOTE,
  confirmSendWithoutReview,
  invoicingTerms,
  termsLabel,
} from '@crazy/shared'
import { Blueprint, Button } from '@crazy/ui'
import { useState } from 'react'
import { useCommand } from '#/lib/useCommand'

/** The terms offered, in the words an invoice already says them in (`termsLabel`). */
const TERMS_CHOICES = [0, 7, 14, 15, 30, 45, 60, 90]

/** The choices offered, and the one this Client is on even if it is none of them. */
const withHeld = (choices: number[], held: number) =>
  [...new Set([...choices, held])].sort((a, b) => a - b)

/**
 * How each Client is billed (frame 2c): when their invoice goes out, how long
 * they have to pay, whether Crazy puts the draft together, and whether it may
 * ever go out without her reading it first.
 *
 * Each Client is a group of its own, labelled by the Client's name, so that
 * every control on this card says whose it is. The frame draws the last two as
 * one pair under the list; they are the Client's, like the terms above them —
 * one Client can be trusted to go out unread while another never is.
 *
 * Send without review is off unless she turns it on, and turning it on takes a
 * second, explicit yes in place. Turning it off again takes one press: getting
 * safer is never something to be asked twice about.
 */
export function InvoiceSettingsCard({ clients }: { clients: readonly ClientInvoicing[] }) {
  const command = useCommand()
  const [confirming, setConfirming] = useState<string | null>(null)
  const set = (clientId: string, change: InvoicingChange) =>
    command.mutate({ type: 'client.setInvoicing', clientId, set: change })

  return (
    <Blueprint as="section" className="card intg-inv" aria-labelledby="intg-inv-title">
      <h2 id="intg-inv-title" className="card-kicker">
        Invoice settings per Client
      </h2>

      {clients.length === 0 && (
        <p className="realtime__note">
          No Clients yet, so there is nothing to bill. Crazy has no way to add one yet.
        </p>
      )}

      {clients.map((client) => {
        const asking = confirming === client.id
        return (
          // A fieldset, so that every control below is announced as this
          // Client's: the legend is the name the row already shows.
          <fieldset key={client.id} className="intg-inv__client">
            <legend className="sr-only">{client.name}</legend>
            <div className="intg-inv__head">
              <span className="intg-inv__name">{client.name}</span>
              <label className="intg-inv__cadence">
                <span className="sr-only">How often {client.name} is invoiced</span>
                <select
                  value={client.cadence}
                  onChange={(event) =>
                    set(client.id, { cadence: event.target.value as ClientCadence })
                  }
                >
                  {CLIENT_CADENCES.map((cadence) => (
                    <option key={cadence} value={cadence}>
                      {CADENCE_WORDS[cadence]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="intg-inv__terms">{invoicingTerms(client)}</p>

            <label className="setting intg-inv__row">
              Payment terms
              <select
                className="input setting__input"
                value={client.paymentTermsDays}
                onChange={(event) =>
                  set(client.id, { paymentTermsDays: Number(event.target.value) })
                }
              >
                {withHeld(TERMS_CHOICES, client.paymentTermsDays).map((days) => (
                  <option key={days} value={days}>
                    {termsLabel(days)}
                  </option>
                ))}
              </select>
            </label>

            <div className="setting intg-inv__row">
              <span id={`${client.id}-auto`}>Auto-draft on cadence</span>
              <button
                type="button"
                role="switch"
                aria-checked={client.autoDraft}
                aria-labelledby={`${client.id}-auto`}
                aria-describedby="intg-inv-auto-note"
                className="switch switch--live"
                onClick={() => set(client.id, { autoDraft: !client.autoDraft })}
              />
            </div>

            <div className="setting intg-inv__row">
              <span id={`${client.id}-send`}>Send without review</span>
              <button
                type="button"
                role="switch"
                aria-checked={client.sendWithoutReview}
                aria-labelledby={`${client.id}-send`}
                aria-describedby="intg-inv-send-note"
                className="switch switch--live"
                onClick={() => {
                  // On is the dangerous way round, and is asked about; off is
                  // the safe one, and happens the moment she presses it.
                  if (client.sendWithoutReview) {
                    setConfirming(null)
                    set(client.id, { sendWithoutReview: false })
                  } else {
                    setConfirming(asking ? null : client.id)
                  }
                }}
              />
            </div>

            {asking && (
              <div className="intg-inv__confirm" role="alert">
                <p className="intg-inv__asking">{confirmSendWithoutReview(client.name)}</p>
                <div className="intg-inv__answers">
                  <Button
                    className="intg-inv__yes"
                    onClick={() => {
                      setConfirming(null)
                      set(client.id, { sendWithoutReview: true })
                    }}
                  >
                    Yes, send unread
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(null)}>
                    Keep reviewing
                  </Button>
                </div>
              </div>
            )}
          </fieldset>
        )
      })}

      <p className="realtime__note" id="intg-inv-auto-note">
        <b className="intg-inv__note-what">Auto-draft.</b> {AUTO_DRAFT_NOTE}
      </p>
      <p className="realtime__note" id="intg-inv-send-note">
        <b className="intg-inv__note-what">Send without review.</b> {SEND_WITHOUT_REVIEW_NOTE}
      </p>
    </Blueprint>
  )
}
