import {
  INTERNAL,
  type TimeClient,
  type TimeRow,
  type TimeView,
  decimalHours,
  rowFlag,
  rowSeconds,
  whenLabel,
} from '@crazy/shared'
import { Table } from '@crazy/ui'
import { Fragment, type ReactNode } from 'react'
import { timeShade } from '#/lib/shades'
import { useCommand } from '#/lib/useCommand'

interface EntriesTableProps {
  rows: TimeRow[]
  clients: TimeClient[]
  view: TimeView
  now: Date
  timeZone: string
  /** The entry open for editing, if the editor is drawn inside the table. */
  openId: string | null
  editor: ReactNode
  onOpen: (row: TimeRow) => void
}

/**
 * The period's Time entries, as frame 2b draws them: when it was, whose work it
 * was with the Client's colour down its left edge, what she was doing, and the
 * hours it came to — decimal, right-aligned and tabular, which is how an
 * invoice counts them. The running entry counts up to the moment the screen is
 * showing and says so.
 *
 * Pressing a row opens it for editing in place. An entry that names no Client
 * says who Crazy thinks it was for, and that line is the one-tap Confirm.
 */
export function EntriesTable({
  rows,
  clients,
  view,
  now,
  timeZone,
  openId,
  editor,
  onOpen,
}: EntriesTableProps) {
  const command = useCommand()

  return (
    <Table className="time__table">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Client · project</th>
          <th scope="col">What</th>
          <th scope="col" className="time__hours-column">
            Hours
          </th>
          <th scope="col">
            <span className="sr-only">Edit</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const flag = rowFlag(row)
          const open = openId === row.id
          return (
            <Fragment key={row.id}>
              <tr
                className={open ? 'time__row is-open' : 'time__row'}
                // A press anywhere on the row opens it, except on a control that
                // means something else of its own.
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest('button')) onOpen(row)
                }}
              >
                <td className="time__when">{whenLabel(row, view, timeZone)}</td>
                {/* A press on the row is a shortcut for the Edit button in it,
                    which is the control a keyboard and a screen reader reach;
                    the cells are cells and are named by their columns. */}
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                <td>
                  <span className="time__work-cell">
                    <span
                      className="time__rule"
                      style={{ background: timeShade(row.clientId, clients) }}
                      aria-hidden="true"
                    />
                    <span className="time__names">
                      <strong>{row.clientName ?? INTERNAL}</strong>
                      <span className="time__project">{row.projectName ?? '—'}</span>
                    </span>
                  </span>
                </td>
                <td className="time__what">
                  {row.note || <span className="time__unsaid">No note</span>}{' '}
                  {row.clientId === null && row.suggestedClientId !== null ? (
                    // The frame's "tap to confirm", where the frame writes it: one
                    // press puts the Client Crazy suggested on the entry.
                    <button
                      type="button"
                      className="time__confirm"
                      disabled={command.isPending}
                      onClick={() =>
                        command.mutate({ type: 'timeEntry.confirmSuggestion', entryId: row.id })
                      }
                    >
                      {flag}
                    </button>
                  ) : (
                    flag && <span className="time__flag-word">{flag}</span>
                  )}
                </td>
                <td className="time__hours">{decimalHours(rowSeconds(row, now))}</td>
                <td className="time__edit">
                  <button
                    type="button"
                    className="btn btn-ghost time__edit-button"
                    aria-expanded={open}
                    onClick={() => onOpen(row)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
              {open && editor !== null && (
                <tr className="time__editor-row">
                  <td colSpan={5}>{editor}</td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </Table>
  )
}
