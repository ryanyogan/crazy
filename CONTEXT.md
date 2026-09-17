# Crazy

One place that reads a person's work and personal tools and tells them what to do with today. It covers both sides of a life on purpose: work projects and personal ones sit in the same day.

## Language

**Today screen**:
The home view for the current day: the brief, the hour timeline and the priority stack.
_Avoid_: Home, dashboard. "Today" alone is ambiguous — it is also a todo state (`today`).

**Shell**:
The single navigation frame around every screen. Its destinations vary with which modules the user has on.
_Avoid_: Layout, chrome

**Billing module**:
The optional capability for people who bill for their time: the timer, time entries, clients and invoices. Off by default; a user turns it on.
_Avoid_: Freelancer mode, Jo mode, time tracking (that is one part of it)

**Provider**:
An outside service a person's work or life runs through, such as Google, Slack or QuickBooks.
_Avoid_: Integration, tool, source, app

**Connection**:
One user's authorised link to one account at a Provider. A user may hold several Connections to the same Provider (a work Google account and a personal one).
_Avoid_: Integration, connector, connected tool, linked account

**Integrations screen**:
The view where a user manages their Connections. "Integration" is a label on this screen only, never a thing in the domain.

**Attachment**:
A file a user deliberately adds to a Todo, such as a photo of a receipt or a screenshot. Media that merely arrives from a Provider is not an Attachment; it stays at the Provider and is linked to.
_Avoid_: Asset, upload, image

## The day

**Brief**:
The first-person summary Crazy writes for a user each morning: what the day holds, what to take first and why, and what happened at Rollover. The **Week brief** is its weekly counterpart.
_Avoid_: Summary, digest, status, report

**Priority stack**:
A user's `today` Todos in the order Crazy recommends doing them, each with a one-line reason. It is an ordering of Todos, not a separate list.
_Avoid_: Queue, to-do list, today list

**Take on now**:
The one Todo Crazy recommends doing at this moment: the highest in the Priority stack that fits the current gap in the calendar. There is one or none.
_Avoid_: Next up, focus task, current task

**Swap**:
Declining the Take on now. The Todo drops one place in the Priority stack for the rest of the day and the next fitting Todo takes its place. Its state does not change and it does not count as Touched.
_Avoid_: Skip, snooze, dismiss

**Slot**:
An hour on the day's timeline that a Todo has been placed on, by the user or at Crazy's suggestion. Meetings occupy hours but are not Slots.
_Avoid_: Block, schedule, time box

## Todos

**Todo**:
One thing a person intends to do, owned by Crazy whether they typed it or it came from a Provider. It is in exactly one state: `backlog`, `today`, `done` or `archived`.
_Avoid_: Task, item, issue, ticket

**Source**:
The Provider item a Todo was made from — a Linear issue, a saved Slack message, a starred email. A Todo has at most one, a Source has at most one open Todo, and a typed-in Todo has none. Completing the Source completes the Todo; nothing else about the Source changes the Todo's state, and Crazy never changes the Source.
_Avoid_: Origin, external item, link

**Touched**:
A Todo is touched on a day if the user created, edited, slotted or snoozed it, or started a timer on it, that day. Appearing in the priority stack is not a touch.
_Avoid_: Active, updated, seen

**Rollover**:
The moment at the user's local midnight when each Todo still in `today` is either carried over or sent back.
_Avoid_: Nightly job, cleanup, end of day

**Carried over**:
At Rollover, a touched but unfinished Todo stays in `today` and its carry count rises by one. "Carried 2 days" means two Rollovers in a row.
_Avoid_: Rolled over, overdue

**Sent back**:
At Rollover, a Todo that has gone untouched for the user's chosen period (one day by default) returns to `backlog` and its carry count resets.
_Avoid_: Demoted, moved to backlog, carried over (a different outcome)

## Projects and billing

**Project**:
A named body of work that Todos and Time entries can belong to, with a status, an optional next milestone and progress derived from its Todos. It may belong to a Client; many never do.
_Avoid_: Job, engagement, workstream, billing project

**One-off**:
A Todo or Time entry with no Project. It may still name a Client, which makes it billable work that is not part of anything larger.
_Avoid_: Misc, ad hoc, unassigned

**Client**:
Someone a user bills for their time, and the holder of the billing terms (rate, rounding, payment terms, invoicing cadence). Exists only with the Billing module on. If a Project has a Client, everything in that Project is for that Client.
_Avoid_: Customer, account, company

**Internal**:
The label shown for work with no Client. It is the absence of a Client, not a Client or a Project of its own.
_Avoid_: Non-billable (an entry for a Client can also be marked not billable), overhead

**Time entry**:
A span of time a user worked, with a start, an end once stopped, and a note. It may name a Client, a Project and the Todo it was started from. The one Time entry without an end is the running timer.
_Avoid_: Timer (the control, not the record), log, session, timesheet row

## Circles

**Circle**:
A group of people and tools a user moves in — a team, a family, a house move. Crazy infers Circles; the user can rename or merge them. A Project belongs to one Circle; a Todo may be matched to several.
_Avoid_: Group, team, workspace, context

**Side**:
Whether something belongs to a user's `work` or `personal` life. It is set only on a Circle; Projects and Todos take theirs from their Circle, and a Todo with no Circle takes the default Side of the Connection it arrived through.
_Avoid_: Category, type, context, mode

**Overlap**:
A Todo matched to more than one Circle, so that doing it serves both.
_Avoid_: Intersection, shared todo

## Signals

**Signal**:
Something Crazy noticed at a Provider that might deserve a Todo: a Mention, a Promise or a Waiting on. A Signal is never a Todo and never becomes one on its own; the user adds it, and the new Todo takes the Signal's Provider item as its Source.
_Avoid_: Follow-up (used loosely for all three kinds), notification, suggestion, inbox item

**Mention**:
A Signal where someone addressed the user at a Provider — a ping, a comment, a review request.
_Avoid_: Ping, notification

**Promise**:
A Signal where the user told someone they would do something. Shown as "You said you'd…".
_Avoid_: Follow-up, commitment, action item

**Waiting on**:
A Signal where someone owes the user something. It never becomes a Todo; it closes when they respond.
_Avoid_: Blocked, pending, follow-up

**Assignment**:
A Provider item that already declares the user intends to do it — an issue assigned to them, an email they starred, a message they saved. The only thing that becomes a Todo without the user adding it; it arrives in `backlog`.
_Avoid_: Auto-todo, imported item
