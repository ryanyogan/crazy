import { z } from 'zod'
import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_REFUSALS,
  type AttachmentType,
  attachmentType,
  isAttachmentType,
} from './attachment'
import { addDays, clockTime, startOfDay } from './clock'
import { type ClientInvoicing, INVOICING_LIMITS, LIFECYCLE_LIMITS } from './integrations'
import { type InvoiceStatus, dueDay, isUnsent } from './invoice'
import { timeZone } from './settings'
import { type DayEvent, LAST_HOUR, hoursIfSlottedAt, meetingHolds } from './timeline'
import { type Signal, formatHour } from './today'
import { type TimeRead, changeTimeRow, insertTimeRow, removeTimeRow } from './time'
import {
  type ProjectFacts,
  type TimeEntryFacts,
  type TimerPicker,
  type TodayTimer,
  addProject,
  changeEntry,
  nameEntry,
  removeEntry,
} from './timer'
import {
  OPEN_TODO_STATES,
  type Side,
  type SignalKind,
  type Source,
  type TodayTodo,
  type TodoState,
  isSnoozed,
  sameSource,
  source,
  clientCadence,
  connectionStatus,
  projectStatus,
  provider,
  side,
  todoState,
} from './todo'

// The command seam. Every change a user can make is a command; `decide` holds
// every domain rule and turns a command into patch operations; `apply` lays
// operations over state. The browser runs both against its cache for the
// optimistic update and the Coordinator runs the same two for the real one,
// which is what keeps the optimistic screen truthful. Neither reads the clock.

const id = z.string().min(1)
/** An hour of the day on the user's wall clock, which is what a Slot is one of. */
const hour = z.number().int().min(0).max(LAST_HOUR)
/** A user's local date: "2025-09-17", never a moment. */
const day = z.string().min(1)

/** How long a Todo can be snoozed for: at least a minute, at most a week. */
export const SNOOZE_MINUTES = { min: 1, max: 7 * 24 * 60 } as const

/** The snoozes a user is offered, in the words they are offered in. */
export const SNOOZE_CHOICES = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 24 * 60, label: '24 hours' },
] as const

/** What a user may change about the lifecycle: at least one of them, each within its limits. */
export const lifecycleChange = z
  .object({
    briefTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sentBackDays: z.number().int().min(1).max(LIFECYCLE_LIMITS.sentBackDays),
    archiveDays: z.number().int().min(1).max(LIFECYCLE_LIMITS.archiveDays),
    /** Where the user's midnight falls, and so when the Rollover runs. */
    timeZone,
  })
  .partial()
  .refine((set) => Object.keys(set).length > 0, 'Nothing to change')
export type LifecycleChange = z.infer<typeof lifecycleChange>

/**
 * What a user may change about how one Client is billed: at least one of them,
 * each within its set or its limits. The rate, the rounding and the arrangement
 * are not here — they are the terms of the work itself, which no screen offers
 * to change yet; these four are what frame 2c puts a control on.
 */
export const invoicingChange = z
  .object({
    cadence: clientCadence,
    paymentTermsDays: z
      .number()
      .int()
      .min(INVOICING_LIMITS.paymentTermsDays.min)
      .max(INVOICING_LIMITS.paymentTermsDays.max),
    /** Whether Crazy puts the next invoice together when the cadence comes due. */
    autoDraft: z.boolean(),
    /** Whether such an invoice may go out unread. Off unless she turns it on. */
    sendWithoutReview: z.boolean(),
  })
  .partial()
  .refine((set) => Object.keys(set).length > 0, 'Nothing to change')
export type InvoicingChange = z.infer<typeof invoicingChange>

export const command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.complete'), todoId: id }),
  // The browser names the new Todo, so its optimistic row and the real one are the same row.
  z.object({ type: z.literal('todo.add'), id, title: z.string().trim().min(1).max(500) }),
  z.object({
    type: z.literal('todo.snooze'),
    todoId: id,
    minutes: z.number().int().min(SNOOZE_MINUTES.min).max(SNOOZE_MINUTES.max),
  }),
  z.object({ type: z.literal('signal.add'), signalId: id, todoId: id }),
  // Catching up on every Promise at once. The browser names each new Todo, as
  // `signal.add` does, and the same rule decides each of them.
  z.object({
    type: z.literal('signal.addAll'),
    adds: z
      .array(z.object({ signalId: id, todoId: id }))
      .min(1)
      .max(100),
  }),
  // Slotting, and moving a Slot, are the same command: the Todo ends up holding
  // the hour named and no other, on the day the user is looking at.
  z.object({ type: z.literal('todo.slot'), todoId: id, hour }),
  z.object({ type: z.literal('todo.clearSlot'), todoId: id }),
  // The lifecycle settings, any of them: what is not named is left as it is.
  z.object({ type: z.literal('settings.set'), set: lifecycleChange }),
  // Sent by the server alone, once Clerk has said the external account is the
  // user's (`SERVER_ONLY`). The row is bookkeeping: no token is in it, or anywhere.
  z.object({ type: z.literal('connection.add'), id, provider, externalAccountId: id }),
  z.object({ type: z.literal('connection.setSide'), connectionId: id, side }),
  // Taking on the Take on now, and declining it. Start says the user is on it
  // now; Swap says not this one, not today.
  z.object({ type: z.literal('todo.start'), todoId: id }),
  z.object({ type: z.literal('todo.swap'), todoId: id }),
  // The Billing module, on or off: the Shell gains or loses Time and Invoices.
  z.object({ type: z.literal('billing.set'), on: z.boolean() }),
  // The timer, which exists only with the Billing module on. Starting names the
  // new Time entry, as `todo.add` names its Todo, so the optimistic row and the
  // real one are the same row. The work is a Client, a Project, both or
  // neither; a Project that has a Client settles it (`workFor`).
  // Started from a Todo, the entry records it, the Todo is marked Touched and
  // started, and the work is the Todo's Project (whose Client wins). A Todo
  // with no Project starts on whatever the bar had chosen, so that the common
  // case — one press, no choosing — stays one press.
  z.object({
    type: z.literal('timer.start'),
    id,
    clientId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    todoId: id.nullable().optional(),
  }),
  // Choosing other work while the timer runs. One command, two operations: the
  // running entry ends at this moment and the next begins at the same instant,
  // so no second of the day falls between them and none is counted twice.
  // Pressing start on a Todo while the timer runs is a switch, not a refusal:
  // one press moves the hours from one Todo to the next at the same instant.
  z.object({
    type: z.literal('timer.switch'),
    id,
    clientId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    todoId: id.nullable().optional(),
  }),
  z.object({ type: z.literal('timer.stop') }),
  // The note the invoice line is written from. It takes the entry's id rather
  // than meaning "the running one", so that editing a stopped entry is the
  // same command when the Time screen comes to ask for it (ticket 20).
  z.object({ type: z.literal('timer.setNote'), entryId: id, note: z.string().trim().max(500) }),
  // The Time screen's three ways of putting the record right (ticket 20). They
  // are Time entry commands rather than timer ones: the timer is the control,
  // and these are about the record it left behind (CONTEXT.md, "Time entry").
  //
  // Editing names only what changed. The Client and the Project are named as a
  // pair — the picker hands back both — so that a Client can never be set onto
  // a Project that contradicts it; `workFor` decides them as it does for a
  // start. Billable follows from having a Client unless the command says
  // otherwise, and then it sticks. The running entry may have its start, its
  // work, its note and its billable flag edited, but it is not given an end
  // here: ending it is `timer.stop`, which decides the end at its own moment.
  z.object({
    type: z.literal('timeEntry.edit'),
    entryId: id,
    startedAt: z.iso.datetime().optional(),
    endedAt: z.iso.datetime().optional(),
    clientId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    note: z.string().trim().max(500).optional(),
    billable: z.boolean().optional(),
  }),
  // Work she forgot to time. The browser names the entry, as `todo.add` names
  // its Todo. An entry added by hand has both ends: a manual entry never makes
  // a second running timer.
  z.object({
    type: z.literal('timeEntry.add'),
    id,
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    clientId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    note: z.string().trim().max(500).optional(),
    billable: z.boolean().optional(),
  }),
  // One tap on the Client Crazy thinks the hours were for. What is applied is
  // the entry's own suggestion, not anything the browser sends, so a stale
  // screen cannot bill the wrong Client.
  z.object({ type: z.literal('timeEntry.confirmSuggestion'), entryId: id }),
  // A mistaken entry, taken out. Only an entry that has ended: the running one
  // is stopped first, so that removing hours is never also stopping a timer.
  z.object({ type: z.literal('timeEntry.remove'), entryId: id }),
  // A Project made where the work is chosen, so that naming one is not a trip
  // to another screen. The browser names it, as `todo.add` names its Todo. A
  // Client is optional and must be the user's; a Project with none is their own.
  z.object({
    type: z.literal('project.add'),
    id,
    name: z.string().trim().min(1).max(200),
    clientId: id.nullable().optional(),
  }),
  // How one Client is billed (frame 2c): when their invoice goes out, how long
  // they have to pay, whether Crazy drafts it for her, and whether it may ever
  // go out without her reading it. The Billing module's, like the timer.
  z.object({ type: z.literal('client.setInvoicing'), clientId: id, set: invoicingChange }),
  // A file put against a Todo (`SERVER_ONLY`). The route that takes the bytes
  // names the Attachment and asks for this before it stores a single one, so
  // that the rule — the Todo is the user's, the type is a picture, the size is
  // within the cap — is decided in the one place every rule is decided. The
  // content type and the size are loose here on purpose: a file that is too
  // big or the wrong sort is a refusal a person can read, not a parse error.
  z.object({
    type: z.literal('attachment.add'),
    id,
    todoId: id,
    contentType: z.string().trim().min(1).max(200),
    size: z.number().int().min(0),
  }),
  // The metadata taken out again (`SERVER_ONLY`). Its one caller is the upload
  // route putting itself right when the bytes could not be stored after the row
  // was: a row pointing at an object that is not there would be a lie.
  z.object({ type: z.literal('attachment.remove'), attachmentId: id }),
  // The Coordinator's own, at the user's local midnight (`SERVER_ONLY`): each
  // `today` Todo is carried over or sent back, and the backlog ages.
  z.object({ type: z.literal('rollover') }),
  // A Provider says the item a Todo was made from is complete. It is the one
  // thing about a Source that moves a Todo; nothing else about it has a command.
  z.object({ type: z.literal('source.completed'), connectionId: id, itemId: id }),
])
export type Command = z.infer<typeof command>

/**
 * Commands a browser may not send: only the server knows what Clerk said, and
 * only the route that moves the bytes may say an Attachment exists — a row
 * without an object behind it, or an object nothing points at, would both be
 * lies a browser could tell.
 */
export const SERVER_ONLY: readonly Command['type'][] = [
  'connection.add',
  'rollover',
  'source.completed',
  'attachment.add',
  'attachment.remove',
]

/** What a command may change about a Todo. Moments are ISO strings: operations travel as JSON. */
export const todoChange = z
  .object({
    state: todoState,
    touchedAt: z.iso.datetime(),
    snoozedUntil: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    carryCount: z.number().int().min(0),
    sentBackAt: z.iso.datetime(),
    /** The user's local day, which is how long a Swap lasts. */
    swappedOnDay: day,
    doneAt: z.iso.datetime().nullable(),
  })
  .partial()
export type TodoChange = z.infer<typeof todoChange>

/** A Todo as it is born: what a command decides, and what D1 stores. The rest starts empty. */
export const newTodo = z.object({
  id,
  title: z.string().min(1),
  state: todoState,
  source: source.nullable(),
  createdAt: z.iso.datetime(),
  touchedAt: z.iso.datetime(),
})
export type NewTodo = z.infer<typeof newTodo>

export const signalChange = z.object({ todoId: z.string().nullable() }).partial()
export type SignalChange = z.infer<typeof signalChange>

/**
 * A Time entry as it is born: started, and for whatever work was chosen. A
 * timer's entry has no end until it is stopped; one added by hand on the Time
 * screen is born with both, so that a manual entry never becomes a second
 * running timer.
 */
export const newTimeEntry = z.object({
  id,
  clientId: id.nullable(),
  projectId: id.nullable(),
  /** The Todo the timer was started from; null for an entry added by hand. */
  todoId: id.nullable(),
  note: z.string(),
  billable: z.boolean(),
  startedAt: z.iso.datetime(),
  /** Null is the running timer: the one Time entry with no end. */
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type NewTimeEntry = z.infer<typeof newTimeEntry>

/**
 * What a command may change about a Time entry: when it began and ended, the
 * work it was for, its note and whether it is billed. What is not named is left
 * as it was, so an edit of the note cannot quietly move the hours.
 */
export const timeEntryChange = z
  .object({
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    note: z.string(),
    billable: z.boolean(),
    clientId: id.nullable(),
    projectId: id.nullable(),
  })
  .partial()
export type TimeEntryChange = z.infer<typeof timeEntryChange>

/**
 * A Project as it is born. A Project belongs to one Circle and takes its Side
 * from it (CONTEXT.md), and Crazy infers Circles: one named by hand has none
 * until Crazy has looked, and no progress, milestone or rate of its own.
 */
export const newProject = z.object({
  id,
  name: z.string().min(1),
  clientId: id.nullable(),
  status: projectStatus,
  createdAt: z.iso.datetime(),
})
export type NewProject = z.infer<typeof newProject>

/**
 * An Attachment as it is born. The key is not here: it is derived from the
 * owner, the Todo and the id where the row is written and where the bytes are
 * put (`attachmentKey`), so no caller can name where a file lands. The content
 * type is the narrow set by the time it is an operation — `decide` has held it
 * to `ATTACHMENT_LIMITS` — so nothing downstream checks again.
 */
export const newAttachment = z.object({
  id,
  todoId: id,
  contentType: attachmentType,
  size: z.number().int().min(1),
  createdAt: z.iso.datetime(),
})
export type NewAttachment = z.infer<typeof newAttachment>

/** A Connection as it is born: the bookkeeping row, and nothing secret (ADR 0001). */
export const newConnection = z.object({
  id,
  provider,
  externalAccountId: id,
  defaultSide: side,
  status: connectionStatus,
  createdAt: z.iso.datetime(),
})
export type NewConnection = z.infer<typeof newConnection>

export const op = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.set'), id, set: todoChange }),
  z.object({ type: z.literal('todo.insert'), todo: newTodo }),
  z.object({ type: z.literal('signal.set'), id, set: signalChange }),
  // Every Slot the Todo holds on that day, as a whole: laid twice it says the same.
  z.object({
    type: z.literal('slot.set'),
    todoId: id,
    day,
    hours: z.array(hour),
    /** When the Slots were given, which is what a new one is created at. */
    at: z.iso.datetime(),
  }),
  z.object({ type: z.literal('settings.set'), set: lifecycleChange }),
  z.object({ type: z.literal('billing.set'), on: z.boolean() }),
  // The Rollover has run for this local day, and will not run for it again.
  z.object({ type: z.literal('rollover.ran'), day }),
  z.object({ type: z.literal('connection.insert'), connection: newConnection }),
  z.object({ type: z.literal('connection.set'), id, set: z.object({ defaultSide: side }) }),
  z.object({ type: z.literal('timeEntry.insert'), entry: newTimeEntry }),
  z.object({ type: z.literal('timeEntry.set'), id, set: timeEntryChange }),
  // A Time entry taken out altogether. Hours that were never worked are worse
  // than no record at all, so a mistaken entry goes rather than being marked.
  z.object({ type: z.literal('timeEntry.delete'), id }),
  z.object({ type: z.literal('project.insert'), project: newProject }),
  // How a Client is billed, changed on the Client itself.
  z.object({ type: z.literal('client.set'), id, set: invoicingChange }),
  // A draft whose Client's payment terms have moved: it falls due on a new day.
  // Only an invoice that has not gone out is re-termed; a sent or paid one
  // keeps the terms it was sent under, which is the whole point of the copy.
  z.object({
    type: z.literal('invoice.set'),
    id,
    set: z.object({ paymentTermsDays: z.number().int().min(0), dueDay: day }),
  }),
  // A file stored against a Todo, and one taken out again. No cached read model
  // holds Attachments — no screen draws one — so neither reaches `apply`.
  z.object({ type: z.literal('attachment.insert'), attachment: newAttachment }),
  z.object({ type: z.literal('attachment.delete'), id }),
])
export type Op = z.infer<typeof op>

/** What the Coordinator hands back and broadcasts: operations, stamped in the order they were committed. */
export const patch = z.object({ seq: z.number().int().positive(), ops: z.array(op) })
export type Patch = z.infer<typeof patch>

/** What `decide` needs to know of a Todo. */
export interface TodoFacts {
  id: string
  state: TodoState
  source: Source | null
  /** The Project it belongs to, which is the work a timer started from it is for. */
  projectId: string | null
  /** While this moment is still to come the Todo has left the day; null when not snoozed. */
  snoozedUntil: string | null
  /** The local day the user last declined it as the Take on now; null if they never have. */
  swappedOnDay: string | null
  /** The hours it holds a Slot on, on the day the state is of (`needsTheDay`). */
  slotHours: readonly number[]
  /** The last time the user touched it, which is what the Rollover goes by. */
  touchedAt: string
  /** How many Rollovers in a row have carried it over. */
  carryCount: number
}

/** What the Rollover needs to know of the user: their midnight, their periods, and the day it last ran for. */
export interface RolloverFacts {
  timeZone: string
  sentBackDays: number
  archiveDays: number
  lastRolloverDay: string | null
}

/** What `decide` needs to know of a Signal. */
export type SignalFacts = Pick<Signal, 'id' | 'kind' | 'who' | 'text' | 'source' | 'todoId'>

/** What `decide` needs to know of a Connection. */
export interface ConnectionFacts {
  id: string
  externalAccountId: string
  defaultSide: Side
}

/** The state a command is decided against: the rows it names, wherever they were loaded from. */
export interface CommandState {
  /** Which day it is on the user's wall clock: the day a Slot falls on. */
  day: string
  /**
   * The user's zone, for the one rule that has to say a time out loud: an
   * overlap is refused by naming the hours it clashed with. Absent, the refusal
   * names the entry without its clock times rather than naming the wrong ones.
   */
  timeZone?: string
  todos: readonly TodoFacts[]
  signals: readonly SignalFacts[]
  /** The day's calendar, so that a command cannot displace a meeting; empty unless `needsTheDay`. */
  events: readonly DayEvent[]
  /** The user's Connections; loaded only for a command about one (`needsConnections`). */
  connections?: readonly ConnectionFacts[]
  /** Loaded only for the Rollover, along with every open Todo (`needsEveryOpenTodo`). */
  settings?: RolloverFacts
  /** Whether the Billing module is on; loaded for a command about the timer (`needsTheTimer`). */
  billing?: boolean
  /**
   * The user's running Time entry, if they have one, and any entry the command
   * names. Loaded only for a timer command (`needsTheTimer`); a timer command
   * decided without it is refused rather than guessed at.
   */
  timeEntries?: readonly TimeEntryFacts[]
  /** The Project a timer command names, if it is the user's (`workNamed`). */
  projects?: readonly ProjectFacts[]
  /**
   * The Client a command names, if it is the user's: a timer's work
   * (`workNamed`), or the Client whose invoice settings are being changed
   * (`clientNamed`). A Client that is not here is gone or somebody else's.
   */
  clients?: readonly ClientFacts[]
  /**
   * The invoices a command is decided against: the ones a named Client has
   * that have not gone out. Loaded only for `client.setInvoicing`, because
   * moving a Client's payment terms moves the day their draft falls due.
   */
  invoices?: readonly InvoiceFacts[]
  /**
   * The Attachments a command names, if they are the user's
   * (`attachmentsNamed`). Loaded only for a command about one.
   */
  attachments?: readonly AttachmentFacts[]
}

/** What `decide` needs to know of an Attachment: that it is the user's, and which Todo it is on. */
export interface AttachmentFacts {
  id: string
  todoId: string
}

/** What `decide` needs to know of a Client. */
export interface ClientFacts {
  id: string
  /** How long they have to pay today; absent where the cache holding them does not say. */
  paymentTermsDays?: number
}

/** What `decide` needs to know of one of the user's invoices. */
export interface InvoiceFacts {
  id: string
  clientId: string
  /** Where it has got to: only one still in hand follows a change of terms. */
  status: InvoiceStatus
  /** The local day it was issued on, which its due day is counted from. */
  issuedDay: string
  paymentTermsDays: number
}

export type Decision = { ok: true; ops: Op[] } | { ok: false; reason: string }

const refuse = (reason: string): Decision => ({ ok: false, reason })

/**
 * The Todo ids a command needs loaded before it can be decided. A command that
 * adds a Signal also needs every open Todo with the Signal's Source; the loader
 * finds those from the Signal (`signalsNamed`).
 */
export function todosNamed(input: Command): string[] {
  switch (input.type) {
    case 'todo.complete':
    case 'todo.snooze':
    case 'todo.slot':
    case 'todo.clearSlot':
    case 'todo.start':
    case 'todo.swap':
      return [input.todoId]
    case 'todo.add':
      return [input.id]
    case 'signal.add':
      return [input.todoId]
    case 'signal.addAll':
      return input.adds.map((add) => add.todoId)
    // A timer started from a Todo is decided against that Todo: whose it is,
    // whether it is still open, and what Project it belongs to.
    case 'timer.start':
    case 'timer.switch':
      return input.todoId ? [input.todoId] : []
    // A file is attached to a Todo, so the Todo is what says whose file it is.
    case 'attachment.add':
      return [input.todoId]
    default:
      return []
  }
}

/** The Signal ids a command needs loaded before it can be decided. */
export function signalsNamed(input: Command): string[] {
  switch (input.type) {
    case 'signal.add':
      return [input.signalId]
    case 'signal.addAll':
      return input.adds.map((add) => add.signalId)
    default:
      return []
  }
}

/**
 * Whether a command plans the day's hours, and so is decided against the day
 * itself: the day's calendar and the Slots the Todos it names already hold.
 * The others are decided against the rows they name alone.
 */
export function needsTheDay(input: Command): boolean {
  return input.type === 'todo.slot' || input.type === 'todo.clearSlot'
}

/** Whether a command is decided against every open Todo the user has, and their settings: the Rollover. */
export function needsEveryOpenTodo(input: Command): boolean {
  return input.type === 'rollover'
}

/** The Source a command names, whose open Todo it is decided against. */
export function sourceNamed(input: Command): Pick<Source, 'connectionId' | 'itemId'> | null {
  return input.type === 'source.completed'
    ? { connectionId: input.connectionId, itemId: input.itemId }
    : null
}

/** Whether a command is about a Connection, and so is decided against the user's Connections. */
export function needsConnections(input: Command): boolean {
  return input.type === 'connection.add' || input.type === 'connection.setSide'
}

/**
 * Whether a command is about the timer, and so is decided against the user's
 * running Time entry and whether their Billing module is on. The running timer
 * is the Time entry with no end: there is nowhere else to look for it.
 */
export function needsTheTimer(input: Command): boolean {
  return input.type.startsWith('timer.') || input.type.startsWith('timeEntry.')
}

/** The Time entry ids a command names, beyond the running one. */
export function timeEntriesNamed(input: Command): string[] {
  switch (input.type) {
    case 'timer.setNote':
    case 'timeEntry.edit':
    case 'timeEntry.confirmSuggestion':
    case 'timeEntry.remove':
      return [input.entryId]
    case 'timeEntry.add':
      return [input.id]
    default:
      return []
  }
}

/**
 * The span a command would have a Time entry occupy, which every other entry of
 * the user's has to keep out of. It is decided from the command and the entry
 * as it stands, because an edit that moves only one end leaves the other where
 * it was; the running entry's span runs to `now`, since that is how much of the
 * day it has taken so far. A command that moves no hours has no span.
 */
export function spanNamed(
  input: Command,
  entry: TimeEntryFacts | undefined,
  now: Date,
): { from: Date; to: Date } | null {
  if (input.type === 'timeEntry.add') {
    return { from: new Date(input.startedAt), to: new Date(input.endedAt) }
  }
  if (input.type !== 'timeEntry.edit' || !entry) return null
  if (input.startedAt === undefined && input.endedAt === undefined) return null
  const from = new Date(input.startedAt ?? entry.startedAt)
  const ended = input.endedAt ?? entry.endedAt
  return { from, to: ended === null ? now : new Date(ended) }
}

/**
 * The Client and Project a command names, whose own rows it is decided against:
 * a Project's Client settles the entry's, so the Project's row has to be read.
 * `project.add` names the id it means to use, so that a clash with a Project
 * the user already has is refused rather than thrown by the database.
 */
export function workNamed(
  input: Command,
): { clientId: string | null; projectId: string | null } | null {
  switch (input.type) {
    case 'timer.start':
    case 'timer.switch':
    case 'timeEntry.add':
      return { clientId: input.clientId ?? null, projectId: input.projectId ?? null }
    // An edit names work only when it says so: an edit of the note alone leaves
    // the Client and the Project exactly where they were.
    case 'timeEntry.edit':
      return namesWork(input)
        ? { clientId: input.clientId ?? null, projectId: input.projectId ?? null }
        : null
    case 'project.add':
      return { clientId: input.clientId ?? null, projectId: input.id }
    default:
      return null
  }
}

/**
 * The Client a command is about rather than merely names as work: its own row,
 * and the invoices it still has in hand, are what such a command is decided
 * against. Only the user's own are ever loaded, so a Client that is not there
 * is not theirs to bill.
 */
export function clientNamed(input: Command): string | null {
  return input.type === 'client.setInvoicing' ? input.clientId : null
}

/**
 * The Attachment ids a command names. Only the user's own are ever loaded, so
 * one that is not there is gone or somebody else's — which is the whole of the
 * rule for taking one out.
 */
export function attachmentsNamed(input: Command): string[] {
  return input.type === 'attachment.remove' ? [input.attachmentId] : []
}

/** A snoozed Todo has left the day: nothing that plans or takes on the day applies to it. */
const OUT_OF_THE_DAY = 'A snoozed Todo is out of the day until its snooze ends.'

/** What stands between a Todo and an hour, once there is something. */
type SlotBlock =
  | { why: 'state' }
  | { why: 'snoozed' }
  | { why: 'day-end' }
  | { why: 'meeting'; hour: number }

/** What the Todo is asking of the day, and what the day says back. */
type Slottable = Pick<TodoFacts, 'state' | 'snoozedUntil' | 'slotHours'>

function slotBlock(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): SlotBlock | null {
  if (todo.state !== 'today') return { why: 'state' }
  if (isSnoozed(todo, now)) return { why: 'snoozed' }
  const hours = hoursIfSlottedAt(todo, hour)
  if (hours.some((each) => each > LAST_HOUR)) return { why: 'day-end' }
  const taken = hours.find((each) => meetingHolds(events, each))
  return taken === undefined ? null : { why: 'meeting', hour: taken }
}

/**
 * Why the day cannot take a Todo at that hour, in a sentence, or null when it
 * can. The rule lives here and not in a component: `decide` refuses in these
 * words, and the screen says them to the user when a drop lands on an hour
 * that cannot take it.
 */
export function slotRefusal(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): string | null {
  const blocked = slotBlock(todo, hour, events, now)
  if (!blocked) return null
  switch (blocked.why) {
    case 'state':
      return 'Only a Todo in the Priority stack can be given a Slot.'
    case 'snoozed':
      return OUT_OF_THE_DAY
    case 'day-end':
      return 'The day ends before that Todo would.'
    case 'meeting':
      return `${formatHour(blocked.hour)} is a meeting, and Crazy never moves a meeting.`
  }
}

/**
 * How one hour reads in a list of hours to choose from: the hour, and in a word
 * or two why it cannot take this Todo. The same rule as `slotRefusal`, said in
 * the room a picker has.
 */
export function hourChoice(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): string {
  const blocked = slotBlock(todo, hour, events, now)
  if (!blocked) return formatHour(hour)
  const brief =
    blocked.why === 'meeting'
      ? blocked.hour === hour
        ? 'a meeting'
        : `a meeting at ${formatHour(blocked.hour)}`
      : blocked.why === 'day-end'
        ? 'past the end of the day'
        : blocked.why === 'snoozed'
          ? 'snoozed'
          : 'not in the stack'
  return `${formatHour(hour)} — ${brief}`
}

/** The same hours, in the same order. */
const sameHours = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((each, index) => each === b[index])

/**
 * The operations that leave a Todo holding exactly `hours` on the day, and none
 * at all when it holds them already, so that slotting where it sits changes
 * nothing. Planning an hour is a touch (CONTEXT.md, "Touched"). Crazy's wording
 * for the hours is left alone: it simply stops describing an hour it was not
 * written for, and describes it again if the user puts it back (`timeline`).
 */
function slotOps(todo: TodoFacts, day: string, hours: number[], at: string): Op[] {
  const held = [...todo.slotHours].sort((a, b) => a - b)
  if (sameHours(held, hours)) return []
  return [
    { type: 'slot.set', todoId: todo.id, day, hours, at },
    { type: 'todo.set', id: todo.id, set: { touchedAt: at } },
  ]
}

/**
 * Nobody is a Todo yet: the Signal is worded by what it noticed until Crazy
 * writes better. A Waiting on never becomes a Todo, so it cannot be worded as one.
 */
export function todoTitleFor(
  signal: Pick<SignalFacts, 'who' | 'text'> & { kind: Exclude<SignalKind, 'waiting_on'> },
): string {
  switch (signal.kind) {
    case 'mention':
      return `Reply to ${signal.who}: ${signal.text}`
    case 'promise':
      return signal.text
  }
}

const isOpen = (todo: TodoFacts) => (OPEN_TODO_STATES as readonly TodoState[]).includes(todo.state)

/** The timer is the Billing module's, and there is no timer without it. */
const BILLING_OFF = 'The timer belongs to the Billing module, which is off.'

/** The same rule, said of the other half of the module: Clients and their invoices. */
const CLIENTS_OFF = 'Clients belong to the Billing module, which is off.'

/** A timer command decided against nothing knows nothing; it must not guess. */
const NO_ENTRIES = 'The timer needs the Time entries of the user it is for.'

/** The Time entry a command names is not the user's, or is no longer there. */
const NOT_YOURS = 'That Time entry is not one of yours.'

/** Whether an edit names the work at all: a note edit leaves the Client alone. */
function namesWork(input: { clientId?: string | null; projectId?: string | null }): boolean {
  return 'clientId' in input || 'projectId' in input
}

/**
 * Whether an entry billed for is billable, once a command has had its say.
 * Work for a Client is billable and the user's own never is — but a contractor
 * who has said "not this one" has said it, so a flag named in the command
 * overrides the default and stays through later edits that do not name it.
 */
function billableFor(
  input: { billable?: boolean },
  clientId: string | null,
  changed: boolean,
): boolean | undefined {
  if (input.billable !== undefined) return input.billable
  return changed ? clientId !== null : undefined
}

/** "09:00–10:42 Meridian Health": the entry an edit would have run over. */
function sayEntry(entry: TimeEntryFacts, now: Date, zone: string | undefined): string {
  const who = entry.clientName ?? null
  if (zone === undefined) return who ? `an entry for ${who}` : 'another entry'
  const from = clockTime(new Date(entry.startedAt), zone)
  const to = clockTime(entry.endedAt === null ? now : new Date(entry.endedAt), zone)
  return `${from}–${to}${who ? ` ${who}` : ''}`
}

/**
 * The entry a span would run over, if any. A user's hours may not overlap: two
 * entries at once would bill one hour twice (CONTEXT.md, "Time entry"), and the
 * running entry counts against the same rule, its span reaching to `now`. Two
 * entries that merely touch — one ending where the next begins — do not
 * overlap, which is what a switch leaves behind.
 */
function overlapping(
  entries: readonly TimeEntryFacts[],
  span: { from: Date; to: Date },
  exceptId: string,
  now: Date,
): TimeEntryFacts | undefined {
  return entries.find((each) => {
    if (each.id === exceptId) return false
    const from = new Date(each.startedAt).getTime()
    const to = each.endedAt === null ? now.getTime() : new Date(each.endedAt).getTime()
    return from < span.to.getTime() && to > span.from.getTime()
  })
}

/**
 * The Todo a timer is started from, or why it cannot be started from it. Only
 * the user's own Todos are ever loaded, so one that is not here is either gone
 * or somebody else's; and a Todo that is done or archived is not one being
 * worked on now. A command that names no Todo has none, which is the bar's own
 * Start and not an error.
 */
function todoTimed(
  state: CommandState,
  todoId: string | null | undefined,
): { ok: true; todo: TodoFacts | null } | { ok: false; reason: string } {
  if (!todoId) return { ok: true, todo: null }
  const todo = state.todos.find((each) => each.id === todoId)
  if (!todo) return { ok: false, reason: 'That Todo no longer exists.' }
  if (!isOpen(todo)) return { ok: false, reason: 'A Todo that is finished cannot be timed.' }
  return { ok: true, todo }
}

/**
 * Starting a timer on a Todo is starting the Todo: it is marked as under way
 * and Touched, exactly as `todo.start` marks it, in the same decision — so the
 * one press says both things and the Rollover carries the Todo over rather
 * than sending it back (CONTEXT.md, "Touched").
 */
function startedTodo(todo: TodoFacts | null, at: string): Op[] {
  return todo === null
    ? []
    : [{ type: 'todo.set', id: todo.id, set: { startedAt: at, touchedAt: at } }]
}

/**
 * What work a timer started from a Todo is for. The Todo's Project settles it —
 * and the Project's Client settles the Client, through `workFor` — so an entry
 * started from a Todo can never contradict the Project the Todo belongs to. A
 * Todo that is part of nothing larger takes the work the bar already had, which
 * is why starting from one is a press and not a choice.
 */
function workOf(
  todo: TodoFacts | null,
  input: { clientId?: string | null; projectId?: string | null },
): { clientId?: string | null; projectId?: string | null } {
  return todo?.projectId ? { projectId: todo.projectId } : input
}

/**
 * The work a Time entry is for, or why it cannot be that work. A Project that
 * has a Client sets that Client, so an entry can never contradict its Project;
 * naming a Client the Project does not have is refused rather than quietly
 * overruled. Neither named is Internal: the absence of a Client, not a Client.
 */
function workFor(
  state: CommandState,
  input: { clientId?: string | null; projectId?: string | null },
): { ok: true; clientId: string | null; projectId: string | null } | { ok: false; reason: string } {
  const projectId = input.projectId ?? null
  const asked = input.clientId ?? null

  if (projectId === null) {
    if (asked !== null && !state.clients?.some((each) => each.id === asked)) {
      return { ok: false, reason: 'That Client is not one of yours.' }
    }
    return { ok: true, clientId: asked, projectId: null }
  }

  const project = state.projects?.find((each) => each.id === projectId)
  if (!project) return { ok: false, reason: 'That Project is not one of yours.' }
  if (asked !== null && asked !== project.clientId) {
    return { ok: false, reason: "That Client is not the Project's Client." }
  }
  return { ok: true, clientId: project.clientId, projectId }
}

/**
 * What adding one Signal decides, and the Todo it would make — which the next
 * Signal in a batch has to be able to see, so that two Promises at the same
 * Provider item end as one Todo rather than two.
 */
type SignalAdd = { ok: true; ops: Op[]; made: TodoFacts | null } | { ok: false; reason: string }

/**
 * The whole rule for turning one Signal into a Todo. `signal.add` is one of
 * these and `signal.addAll` is a run of them, so there is one rule and not two.
 */
function addOneSignal(
  todos: readonly TodoFacts[],
  signal: SignalFacts,
  todoId: string,
  at: string,
): SignalAdd {
  const { kind } = signal
  if (kind === 'waiting_on') {
    return { ok: false, reason: 'A Waiting on never becomes a Todo: it closes when they respond.' }
  }
  // Added twice, or on two devices at once: it is a Todo, which is what was asked.
  if (signal.todoId !== null) return { ok: true, ops: [], made: null }
  // One Source, one open Todo: the Signal is that Todo's, and nothing new is made.
  const open = todos.find(
    (each) => isOpen(each) && each.source !== null && sameSource(each.source, signal.source),
  )
  if (open) {
    // Adding is the user deciding it enters their day, so a Todo waiting in the
    // backlog comes into it, and that move is a touch. One already in `today` is
    // left alone: attaching a Signal to it is not a touch (CONTEXT.md, "Touched").
    const enters: Op[] =
      open.state === 'backlog'
        ? [{ type: 'todo.set', id: open.id, set: { state: 'today', touchedAt: at } }]
        : []
    return {
      ok: true,
      ops: [...enters, { type: 'signal.set', id: signal.id, set: { todoId: open.id } }],
      made: null,
    }
  }
  if (todos.some((each) => each.id === todoId)) {
    return { ok: false, reason: 'That Todo already exists.' }
  }
  const todo: NewTodo = {
    id: todoId,
    title: todoTitleFor({ ...signal, kind }),
    state: 'today',
    source: signal.source,
    createdAt: at,
    touchedAt: at,
  }
  return {
    ok: true,
    ops: [
      { type: 'todo.insert', todo },
      { type: 'signal.set', id: signal.id, set: { todoId: todo.id } },
    ],
    made: {
      id: todo.id,
      state: 'today',
      source: todo.source,
      projectId: null,
      snoozedUntil: null,
      swappedOnDay: null,
      slotHours: [],
      touchedAt: at,
      carryCount: 0,
    },
  }
}

export function decide(state: CommandState, input: Command, now: Date): Decision {
  const at = now.toISOString()
  switch (input.type) {
    case 'todo.complete': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state === 'archived') return refuse('An archived Todo cannot be completed.')
      // Ticked twice, or on two devices at once: it is done, which is what was asked.
      if (todo.state === 'done') return { ok: true, ops: [] }
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { state: 'done', doneAt: at } }],
      }
    }

    case 'todo.add': {
      if (state.todos.some((each) => each.id === input.id))
        return refuse('That Todo already exists.')
      // Typed in: a One-off with no Source, in the day it was typed into. Creating is a touch.
      const todo: NewTodo = {
        id: input.id,
        title: input.title,
        state: 'today',
        source: null,
        createdAt: at,
        touchedAt: at,
      }
      return { ok: true, ops: [{ type: 'todo.insert', todo }] }
    }

    case 'todo.snooze': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state !== 'today') return refuse('Only a Todo in the Priority stack can be snoozed.')
      const until = new Date(now.getTime() + input.minutes * 60_000).toISOString()
      // Snoozing is a touch: a Todo put off on purpose is carried over, not sent back.
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { snoozedUntil: until, touchedAt: at } }],
      }
    }

    case 'signal.add': {
      const signal = state.signals.find((each) => each.id === input.signalId)
      if (!signal) return refuse('That Signal no longer exists.')
      const decided = addOneSignal(state.todos, signal, input.todoId, at)
      return decided.ok ? { ok: true, ops: decided.ops } : refuse(decided.reason)
    }

    case 'signal.addAll': {
      const ops: Op[] = []
      // Each Signal is decided against what the ones before it made, so a
      // Promise whose Source another has just become is that same Todo. A
      // Signal already added decides nothing, which is how "turn all into
      // todos" pressed twice makes one Todo apiece and not two.
      let todos = state.todos
      for (const { signalId, todoId } of input.adds) {
        const signal = state.signals.find((each) => each.id === signalId)
        if (!signal) return refuse('That Signal no longer exists.')
        const decided = addOneSignal(todos, signal, todoId, at)
        if (!decided.ok) return refuse(decided.reason)
        ops.push(...decided.ops)
        if (decided.made) todos = [...todos, decided.made]
      }
      return { ok: true, ops }
    }

    case 'todo.slot': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      const refusal = slotRefusal(todo, input.hour, state.events, now)
      if (refusal) return refuse(refusal)
      return { ok: true, ops: slotOps(todo, state.day, hoursIfSlottedAt(todo, input.hour), at) }
    }

    case 'todo.clearSlot': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      // A Todo that has left the day has nothing to take off it, and must not be
      // touched by the asking: a touch would change what the Rollover does with
      // it. A snoozed Todo is still in `today`, and can be taken off its hour.
      if (todo.state !== 'today') return { ok: true, ops: [] }
      return { ok: true, ops: slotOps(todo, state.day, [], at) }
    }

    case 'settings.set':
      return { ok: true, ops: [{ type: 'settings.set', set: input.set }] }

    case 'connection.add': {
      const connections = state.connections ?? []
      // Reconciled twice, or from two tabs at once: it is a Connection, which is what was asked.
      if (connections.some((each) => each.externalAccountId === input.externalAccountId)) {
        return { ok: true, ops: [] }
      }
      if (connections.some((each) => each.id === input.id)) {
        return refuse('That Connection already exists.')
      }
      // Work until the user says otherwise: a second account is theirs to call personal.
      const connection: NewConnection = {
        id: input.id,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
        defaultSide: 'work',
        status: 'connected',
        createdAt: at,
      }
      return { ok: true, ops: [{ type: 'connection.insert', connection }] }
    }

    case 'connection.setSide': {
      const connection = state.connections?.find((each) => each.id === input.connectionId)
      if (!connection) return refuse('That Connection no longer exists.')
      if (connection.defaultSide === input.side) return { ok: true, ops: [] }
      return {
        ok: true,
        ops: [{ type: 'connection.set', id: connection.id, set: { defaultSide: input.side } }],
      }
    }

    // Nothing the user has is lost by turning it off: Clients and Time entries wait in D1.
    case 'billing.set':
      return { ok: true, ops: [{ type: 'billing.set', on: input.on }] }

    case 'rollover': {
      const { settings } = state
      if (!settings) return refuse('The Rollover needs the settings of the user it is for.')
      // Woken twice for one midnight, it is the same midnight: nothing is carried a second time.
      if (settings.lastRolloverDay === state.day) return { ok: true, ops: [] }
      const before = (days: number) =>
        startOfDay(addDays(state.day, -days), settings.timeZone).toISOString()
      // The day that has just ended: touched within it is Touched, 23:50 included.
      const yesterday = before(1)
      const sentBackBefore = before(settings.sentBackDays)
      const archiveBefore = before(settings.archiveDays)

      const ops: Op[] = []
      for (const todo of state.todos) {
        if (todo.state === 'today') {
          if (todo.touchedAt >= yesterday) {
            // Carried over: it stays, and is offered afresh rather than read as under way.
            ops.push({
              type: 'todo.set',
              id: todo.id,
              set: { carryCount: todo.carryCount + 1, startedAt: null },
            })
          } else if (todo.touchedAt < sentBackBefore) {
            ops.push({
              type: 'todo.set',
              id: todo.id,
              set: { state: 'backlog', carryCount: 0, sentBackAt: at, startedAt: null },
            })
          }
          // Untouched, but for less than the user's period: it waits where it is,
          // and its run of carried-over days is neither added to nor broken.
        } else if (todo.state === 'backlog' && todo.touchedAt < archiveBefore) {
          ops.push({ type: 'todo.set', id: todo.id, set: { state: 'archived' } })
        }
      }
      return { ok: true, ops: [...ops, { type: 'rollover.ran', day: state.day }] }
    }

    case 'source.completed': {
      const todo = state.todos.find(
        (each) =>
          isOpen(each) &&
          each.source?.connectionId === input.connectionId &&
          each.source.itemId === input.itemId,
      )
      // No open Todo has that Source: there is nothing of the user's to finish.
      if (!todo) return { ok: true, ops: [] }
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { state: 'done', doneAt: at } }],
      }
    }

    case 'todo.start': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state !== 'today') return refuse('Only a Todo in the Priority stack can be started.')
      // A Todo the user has put out of the day is not one they are starting.
      if (isSnoozed(todo, now)) return refuse(OUT_OF_THE_DAY)
      // Starting is a touch: a Todo worked on is carried over, not sent back.
      // Pressed again it says the same thing of a later moment, which is what
      // "I am on this now" means; nothing is lost, because nothing read the first.
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { startedAt: at, touchedAt: at } }],
      }
    }

    case 'todo.swap': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state !== 'today') return refuse('Only a Todo in the Priority stack can be swapped.')
      if (isSnoozed(todo, now)) return refuse(OUT_OF_THE_DAY)
      // Declined twice, or on two devices at once: it is already a place lower
      // and out of the running for today, which is what was asked.
      if (todo.swappedOnDay === state.day) return { ok: true, ops: [] }
      // Declining is not touching it (CONTEXT.md, "Swap"): a Todo the user
      // keeps dodging must still be sent back at the Rollover. Its state does
      // not change either — only where it sits, and only until midnight.
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { swappedOnDay: state.day } }],
      }
    }

    case 'timer.start': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      if (entries.some((each) => each.id === input.id)) {
        return refuse('That Time entry already exists.')
      }
      // At most one Time entry per user has no end, so that hours can never
      // overlap (CONTEXT.md, "Time entry"). Starting on top of a running timer
      // is refused and not quietly stopped and started: moving work while it
      // runs is `timer.switch`, which splits the entry and says so.
      if (entries.some((each) => each.endedAt === null)) {
        return refuse('A timer is already running. Stop it before starting another.')
      }
      const timed = todoTimed(state, input.todoId)
      if (!timed.ok) return refuse(timed.reason)
      const work = workFor(state, workOf(timed.todo, input))
      if (!work.ok) return refuse(work.reason)
      return {
        ok: true,
        ops: [
          {
            type: 'timeEntry.insert',
            entry: {
              id: input.id,
              clientId: work.clientId,
              projectId: work.projectId,
              todoId: timed.todo?.id ?? null,
              note: '',
              // Work for a Client is billable until the user says otherwise;
              // their own never is, which is how the seed reads it too.
              billable: work.clientId !== null,
              startedAt: at,
              endedAt: null,
              createdAt: at,
            },
          },
          ...startedTodo(timed.todo, at),
        ],
      }
    }

    // Choosing other work while the timer runs. The entry that was running is
    // given its end and the next is begun at the same instant, so the day has
    // no gap in it and no second is counted twice (spec, story 87).
    case 'timer.switch': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      if (entries.some((each) => each.id === input.id)) {
        return refuse('That Time entry already exists.')
      }
      const running = entries.find((each) => each.endedAt === null)
      // Nothing to split. Beginning from idle is `timer.start`, which says so
      // rather than quietly inventing the first half of a switch.
      if (!running) return refuse('No timer is running. Press start to begin one.')
      const timed = todoTimed(state, input.todoId)
      if (!timed.ok) return refuse(timed.reason)
      const work = workFor(state, workOf(timed.todo, input))
      if (!work.ok) return refuse(work.reason)
      // Pressed on the Todo the running entry already names: the timer is on it
      // and a split would leave two rows in the timesheet where the day means one.
      if (timed.todo && running.todoId === timed.todo.id) {
        return refuse('The timer is already on that Todo.')
      }
      // Switching to the work already running would end an entry and begin an
      // identical one at the same instant — unless the Todo is what changed,
      // which two spells on one Project for one Client genuinely are.
      if (
        !timed.todo &&
        work.clientId === running.clientId &&
        work.projectId === running.projectId
      ) {
        return refuse('The timer is already on that work.')
      }
      return {
        ok: true,
        ops: [
          { type: 'timeEntry.set', id: running.id, set: { endedAt: at } },
          {
            type: 'timeEntry.insert',
            entry: {
              id: input.id,
              clientId: work.clientId,
              projectId: work.projectId,
              todoId: timed.todo?.id ?? null,
              note: '',
              billable: work.clientId !== null,
              startedAt: at,
              endedAt: null,
              createdAt: at,
            },
          },
          ...startedTodo(timed.todo, at),
        ],
      }
    }

    case 'timer.stop': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      const running = entries.find((each) => each.endedAt === null)
      // Pressed on a timer another device has already stopped: there is nothing
      // running to give an end to, and inventing one would invent hours.
      if (!running) return refuse('No timer is running.')
      return { ok: true, ops: [{ type: 'timeEntry.set', id: running.id, set: { endedAt: at } }] }
    }

    case 'timer.setNote': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      // Only the user's own entries are ever loaded, so one that is not there
      // is either gone or somebody else's; neither is the user's to word.
      const entry = entries.find((each) => each.id === input.entryId)
      if (!entry) return refuse(NOT_YOURS)
      return { ok: true, ops: [{ type: 'timeEntry.set', id: entry.id, set: { note: input.note } }] }
    }

    // Putting the record right on the Time screen (spec, stories 99 and 102).
    // Everything the rule cares about is the same as a timer's: whose the entry
    // is, whose the work is, and that no two spells of hers overlap.
    case 'timeEntry.edit': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      const entry = entries.find((each) => each.id === input.entryId)
      if (!entry) return refuse(NOT_YOURS)
      // Ending the running entry is `timer.stop`, which decides the end at its
      // own moment; naming one here would let a browser's clock bill an hour.
      if (entry.endedAt === null && input.endedAt !== undefined) {
        return refuse('That timer is still running. Stop it to give it an end.')
      }

      const set: TimeEntryChange = {}
      if (input.startedAt !== undefined) set.startedAt = input.startedAt
      if (input.endedAt !== undefined) set.endedAt = input.endedAt
      if (input.note !== undefined) set.note = input.note

      const span = spanNamed(input, entry, now)
      if (span) {
        if (span.to <= span.from) return refuse('An entry has to end after it began.')
        // Hours in the future are hours nobody has worked yet.
        if (entry.endedAt !== null && span.to > now) {
          return refuse('An entry cannot end in the future.')
        }
        if (span.from > now) return refuse('An entry cannot begin in the future.')
        const clash = overlapping(entries, span, entry.id, now)
        if (clash) return refuse(`That overlaps ${sayEntry(clash, now, state.timeZone)}.`)
      }

      const changed = namesWork(input)
      let clientId = entry.clientId
      if (changed) {
        const work = workFor(state, input)
        if (!work.ok) return refuse(work.reason)
        clientId = work.clientId
        set.clientId = work.clientId
        set.projectId = work.projectId
      }
      const billable = billableFor(input, clientId, changed)
      if (billable !== undefined) set.billable = billable

      // Nothing named is nothing to do, which is what a row left as it was means.
      if (Object.keys(set).length === 0) return { ok: true, ops: [] }
      return { ok: true, ops: [{ type: 'timeEntry.set', id: entry.id, set }] }
    }

    // Work she forgot to time (spec, story 100).
    case 'timeEntry.add': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      if (entries.some((each) => each.id === input.id)) {
        return refuse('That Time entry already exists.')
      }
      const span = { from: new Date(input.startedAt), to: new Date(input.endedAt) }
      if (span.to <= span.from) return refuse('An entry has to end after it began.')
      if (span.to > now) return refuse('An entry cannot end in the future.')
      const clash = overlapping(entries, span, input.id, now)
      if (clash) return refuse(`That overlaps ${sayEntry(clash, now, state.timeZone)}.`)

      const work = workFor(state, input)
      if (!work.ok) return refuse(work.reason)
      return {
        ok: true,
        ops: [
          {
            type: 'timeEntry.insert',
            entry: {
              id: input.id,
              clientId: work.clientId,
              projectId: work.projectId,
              // An entry added by hand was not started from a Todo: nothing
              // was under way, it is being written down afterwards.
              todoId: null,
              note: input.note ?? '',
              billable: input.billable ?? work.clientId !== null,
              startedAt: input.startedAt,
              endedAt: input.endedAt,
              createdAt: at,
            },
          },
        ],
      }
    }

    // One tap on the Client Crazy thinks the hours were for (spec, story 101).
    case 'timeEntry.confirmSuggestion': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      const entry = entries.find((each) => each.id === input.entryId)
      if (!entry) return refuse(NOT_YOURS)
      const clientId = entry.suggestedClientId ?? null
      // Nothing is guessed here: what is applied is the entry's own suggestion,
      // so a stale screen cannot bill hours to a Client it merely remembers.
      if (clientId === null) return refuse('Crazy has no Client to suggest for that entry.')
      const work = workFor(state, {
        clientId,
        projectId: entry.suggestedProjectId ?? null,
      })
      if (!work.ok) return refuse(work.reason)
      return {
        ok: true,
        ops: [
          {
            type: 'timeEntry.set',
            id: entry.id,
            set: {
              clientId: work.clientId,
              projectId: work.projectId,
              // Confirmed hours are for a Client, so they are billable: the
              // default follows the Client, as it does everywhere else.
              billable: true,
            },
          },
        ],
      }
    }

    // A mistaken entry, taken out (beyond the ticket's checklist; see Comments).
    case 'timeEntry.remove': {
      if (!state.billing) return refuse(BILLING_OFF)
      const entries = state.timeEntries
      if (!entries) return refuse(NO_ENTRIES)
      const entry = entries.find((each) => each.id === input.entryId)
      if (!entry) return refuse(NOT_YOURS)
      if (entry.endedAt === null) {
        return refuse('That timer is still running. Stop it before removing the entry.')
      }
      return { ok: true, ops: [{ type: 'timeEntry.delete', id: entry.id }] }
    }

    // A Project named where the work is chosen. Only the two things a person
    // can say are stored: what it is called and, if anyone, who it is for.
    case 'project.add': {
      if (state.projects?.some((each) => each.id === input.id)) {
        return refuse('That Project already exists.')
      }
      const clientId = input.clientId ?? null
      // Only the user's own Clients are ever loaded, so one that is not there
      // is either gone or somebody else's; neither is theirs to bill.
      if (clientId !== null && !state.clients?.some((each) => each.id === clientId)) {
        return refuse('That Client is not one of yours.')
      }
      return {
        ok: true,
        ops: [
          {
            type: 'project.insert',
            project: {
              id: input.id,
              name: input.name,
              clientId,
              status: 'on_track',
              createdAt: at,
            },
          },
        ],
      }
    }

    // A file stored against a Todo. Decided before a single byte is stored, so
    // that nothing a user does not own, nothing that is not a picture and
    // nothing over the cap ever reaches the bucket. The size is the one the
    // caller has counted off the body itself, never a header it was handed.
    case 'attachment.add': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      // Only the user's own Todos are ever loaded: one that is not here is
      // gone or somebody else's, and the two are not told apart on purpose.
      if (!todo) return refuse(ATTACHMENT_REFUSALS.notYourTodo)
      if (!isAttachmentType(input.contentType)) return refuse(ATTACHMENT_REFUSALS.type)
      if (input.size < 1) return refuse(ATTACHMENT_REFUSALS.empty)
      if (input.size > ATTACHMENT_LIMITS.maxBytes) return refuse(ATTACHMENT_REFUSALS.size)
      const contentType: AttachmentType = input.contentType
      return {
        ok: true,
        ops: [
          {
            type: 'attachment.insert',
            attachment: {
              id: input.id,
              todoId: todo.id,
              contentType,
              size: input.size,
              createdAt: at,
            },
          },
        ],
      }
    }

    // The metadata taken out again: the upload route's way of putting itself
    // right when the bytes could not be stored after the row was.
    case 'attachment.remove': {
      const held = state.attachments?.find((each) => each.id === input.attachmentId)
      if (!held) return refuse(ATTACHMENT_REFUSALS.notYours)
      return { ok: true, ops: [{ type: 'attachment.delete', id: held.id }] }
    }

    // How one Client is billed (frame 2c). A Client exists only with the
    // Billing module on, so the settings do too; and only the user's own
    // Clients are ever loaded, so one that is not there is not theirs.
    case 'client.setInvoicing': {
      if (!state.billing) return refuse(CLIENTS_OFF)
      const client = state.clients?.find((each) => each.id === input.clientId)
      if (!client) return refuse('That Client is not one of yours.')

      const ops: Op[] = [{ type: 'client.set', id: client.id, set: input.set }]
      // Terms are what an invoice is due under, and a draft is still hers to
      // change: one she has not sent follows the Client's terms, and moves the
      // day it falls due with them. A sent or paid invoice keeps its own.
      const terms = input.set.paymentTermsDays
      if (terms !== undefined) {
        for (const invoice of state.invoices ?? []) {
          if (invoice.clientId !== client.id || !isUnsent(invoice.status)) continue
          if (invoice.paymentTermsDays === terms) continue
          ops.push({
            type: 'invoice.set',
            id: invoice.id,
            set: { paymentTermsDays: terms, dueDay: dueDay(invoice.issuedDay, terms) },
          })
        }
      }
      return { ok: true, ops }
    }
  }
}

/** A Todo as read models hold it, the moment it is born. */
function born(todo: NewTodo): TodayTodo {
  return {
    ...todo,
    project: null,
    projectId: null,
    clientId: null,
    clientName: null,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    stackPosition: null,
    reason: null,
    slotHours: [],
    snoozedUntil: null,
    startedAt: null,
    swappedOnDay: null,
    doneAt: null,
  }
}

/** What a patch is laid over: the Today read model, the one cached state that holds Todos. */
export interface Applicable {
  /** Absent from a read model that holds no Todos: the Integrations screen's. */
  todos?: readonly TodayTodo[]
  settings?: LifecycleChange
  /** Whether the Billing module is on, where a state says: the Shell's, and the Integrations screen's. */
  billing?: boolean
  connections?: readonly { id: string; defaultSide: Side }[]
  signals?: readonly { id: string; todoId: string | null }[]
  /** The day these rows are of; a state that does not say which cannot hold Slots. */
  day?: string
  /** The timer's rows, where a state holds them: Today's, and null with the Billing module off. */
  timer?: TodayTimer | null
  /** What the picker offers, beside them: every Client and Project the user has. */
  picker?: TimerPicker | null
  /** One period of the timesheet, where a state holds one: the Time screen's. */
  time?: TimeRead | null
  /**
   * The Clients and how each is billed, where a state holds them: the
   * Integrations screen's, with the Billing module on.
   */
  clients?: readonly ClientInvoicing[]
  /** The zone its days are read in; a state that holds a period says which. */
  timeZone?: string
}

/**
 * Lays operations over any state that holds Todos, and returns the new state.
 * An operation on a row the state does not hold changes nothing, so a patch
 * can be applied to every cached read model without asking which it concerns;
 * and inserting a row the state already holds replaces it, so a patch applied
 * twice (once as the answer to a command, once over the socket) ends the same.
 */
export function apply<S extends Applicable>(state: S, ops: readonly Op[]): S {
  let todos = state.todos
  let signals = state.signals
  let settings = state.settings
  let connections = state.connections
  let billing = state.billing
  let timer = state.timer
  let picker = state.picker
  let time = state.time
  let clients = state.clients
  for (const each of ops) {
    switch (each.type) {
      case 'todo.set':
        todos = todos?.map((todo) => (todo.id === each.id ? { ...todo, ...each.set } : todo))
        break
      case 'todo.insert': {
        if (!todos) break
        const held = todos
        const row = born(each.todo)
        todos = held.some((todo) => todo.id === row.id)
          ? held.map((todo) => (todo.id === row.id ? row : todo))
          : [...held, row]
        break
      }
      case 'signal.set':
        signals = signals?.map((signal) =>
          signal.id === each.id ? { ...signal, ...each.set } : signal,
        )
        break
      // Slots belong to one day, so a state of another day (or one that does
      // not say which) is left alone.
      case 'slot.set': {
        if (state.day !== each.day) break
        const held = todos?.find((todo) => todo.id === each.todoId)
        // A Todo the state does not hold, or one already on those hours, leaves
        // the cache as it is: an applied patch must not churn what nothing read.
        if (!held || sameHours(held.slotHours, each.hours)) break
        todos = todos?.map((todo) =>
          todo.id === each.todoId ? { ...todo, slotHours: [...each.hours] } : todo,
        )
        break
      }
      case 'settings.set':
        if (settings) settings = { ...settings, ...each.set }
        break
      case 'billing.set':
        if (billing !== undefined) billing = each.on
        break
      // A Connection born elsewhere has Clerk's word to be read with it, which a
      // patch does not carry: `bornElsewhere` is how a screen knows to read again.
      case 'connection.insert':
        break
      // The day has turned over: a tab showing yesterday reads again (`namesAnotherDay`).
      case 'rollover.ran':
        break
      case 'connection.set':
        connections = connections?.map((connection) =>
          connection.id === each.id ? { ...connection, ...each.set } : connection,
        )
        break
      // A started timer, worded with the names this cache already holds. One it
      // cannot name is left alone and read again (`namesUnknownWork`): a patch
      // carries the Client's id, never its name. Applied twice — once as the
      // answer to the command, once over the socket — it says the same thing.
      case 'timeEntry.insert': {
        if (time) time = insertTimeRow(time, each.entry, state.timeZone ?? 'UTC')
        if (!timer) break
        const entry = nameEntry(timer, each.entry, picker)
        if (!entry) break
        timer = {
          ...timer,
          // An entry added by hand is born with both ends, and is nobody's
          // running timer: only one with no end takes the bar.
          running: entry.endedAt === null ? entry : timer.running,
          today: [entry, ...timer.today.filter((held) => held.id !== entry.id)],
        }
        break
      }
      case 'timeEntry.set':
        if (timer) timer = changeEntry(timer, each.id, each.set, picker)
        if (time) time = changeTimeRow(time, each.id, each.set)
        break
      case 'timeEntry.delete':
        if (timer) timer = removeEntry(timer, each.id)
        if (time) time = removeTimeRow(time, each.id)
        break
      // A Project named in the picker joins it at once, so that the switch
      // that follows can be worded and chosen without reading the day again.
      case 'project.insert':
        if (picker) picker = addProject(picker, each.project)
        break
      // How a Client is billed, on the one screen that holds them.
      case 'client.set':
        clients = clients?.map((client) =>
          client.id === each.id ? { ...client, ...each.set } : client,
        )
        break
      // A re-termed draft: no cached state holds invoices — the Invoices screen
      // reads its own query and is never patched — so there is nothing to lay
      // this over. It is written to D1 and read back with the screen.
      case 'invoice.set':
        break
      // No screen draws an Attachment yet, so no cached state holds one and
      // there is nothing to lay these over. They are written to D1 and read
      // back by the route that serves the file (docs/BRIEF.md).
      case 'attachment.insert':
      case 'attachment.delete':
        break
    }
  }
  if (
    todos === state.todos &&
    signals === state.signals &&
    settings === state.settings &&
    billing === state.billing &&
    connections === state.connections &&
    timer === state.timer &&
    picker === state.picker &&
    time === state.time &&
    clients === state.clients
  ) {
    return state
  }
  // The rows keep their own shapes; only the columns an operation names have changed.
  return {
    ...state,
    ...(todos === state.todos ? {} : { todos }),
    ...(signals === state.signals ? {} : { signals }),
    ...(settings === state.settings ? {} : { settings }),
    ...(billing === state.billing ? {} : { billing }),
    ...(connections === state.connections ? {} : { connections }),
    ...(timer === state.timer ? {} : { timer }),
    ...(picker === state.picker ? {} : { picker }),
    ...(time === state.time ? {} : { time }),
    ...(clients === state.clients ? {} : { clients }),
  } as S
}

/**
 * Whether operations start a Time entry whose Client, Project or Todo a cached
 * timer cannot name. A patch carries ids, and the names live in rows it does
 * not carry, so such a tab reads the day again rather than showing half a line.
 * An unnamed Client or Project leaves the entry out of the cache altogether; an
 * unnamed Todo only leaves its title off, so the hours show at once either way
 * and the words catch up. A state with no timer — the Billing module is off, or
 * this screen holds none — has nothing to read again.
 */
export function namesUnknownWork(
  state: Pick<Applicable, 'timer' | 'picker'>,
  ops: readonly Op[],
): boolean {
  const { timer } = state
  if (!timer) return false
  return ops.some((each) => {
    if (each.type !== 'timeEntry.insert') return false
    const named = nameEntry(timer, each.entry, state.picker)
    return named === null || (named.todoId !== null && named.todoTitle === null)
  })
}

/**
 * Whether operations name a day other than the one a cached state is of. A Slot
 * written on another day is how a tab learns that the user's day has turned
 * over while it was open: `apply` rightly leaves such an operation alone, and
 * what the tab is showing is yesterday, so it reads everything again.
 */
export function namesAnotherDay(state: Pick<Applicable, 'day'>, ops: readonly Op[]): boolean {
  const { day } = state
  if (day === undefined) return false
  return ops.some(
    (each) => (each.type === 'slot.set' || each.type === 'rollover.ran') && each.day !== day,
  )
}

/** Whether operations bring a Connection a cached screen has never read. */
export function bornElsewhere(ops: readonly Op[]): boolean {
  return ops.some((each) => each.type === 'connection.insert')
}

/**
 * The row an operation touches. Todo ids and Signal ids are separate
 * namespaces, and a Todo's Slots on one day are a row of their own.
 */
function rowTouched(each: Op): string {
  switch (each.type) {
    case 'todo.insert':
      return `todo:${each.todo.id}`
    case 'todo.set':
      return `todo:${each.id}`
    case 'signal.set':
      return `signal:${each.id}`
    case 'slot.set':
      return `slot:${each.todoId}:${each.day}`
    case 'settings.set':
    case 'rollover.ran':
      return 'settings'
    case 'billing.set':
      return 'billing'
    case 'connection.insert':
      return `connection:${each.connection.id}`
    case 'connection.set':
      return `connection:${each.id}`
    case 'timeEntry.insert':
      return `timeEntry:${each.entry.id}`
    case 'timeEntry.set':
    case 'timeEntry.delete':
      return `timeEntry:${each.id}`
    case 'project.insert':
      return `project:${each.project.id}`
    case 'client.set':
      return `client:${each.id}`
    case 'invoice.set':
      return `invoice:${each.id}`
    case 'attachment.insert':
      return `attachment:${each.attachment.id}`
    case 'attachment.delete':
      return `attachment:${each.id}`
  }
}

/**
 * Whether every row the browser's guess touched is touched by `ops` too. The
 * browser decides against its cache, which does not hold everything D1 does
 * (a `backlog` Todo, say), so the Coordinator may rightly decide fewer or
 * other operations: the browser guesses `todo.insert` + `signal.set` for a
 * Mention, and the Coordinator answers `[]` (another tab added it first) or
 * the `signal.set` alone (the Source already has an open Todo). Laying that
 * patch over the optimistic cache leaves the guessed Todo behind, so when the
 * patch does not cover the guess the browser must fetch the truth instead.
 */
export function covers(guess: readonly Op[], ops: readonly Op[]): boolean {
  const touched = new Set(ops.map(rowTouched))
  return guess.every((each) => touched.has(rowTouched(each)))
}

/** What the Coordinator answers a command with. A refusal is an answer, not a failure. */
export type CommandResult = { ok: true; patch: Patch } | { ok: false; reason: string }
