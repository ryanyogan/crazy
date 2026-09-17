# 04 — Today screen shows the hour timeline and Mentions

**What to build:** Ryan sees the rest of the Today screen as drawn: the hour-by-hour timeline with meetings as tinted fills, focus blocks framed, free hours dashed and Todos in their Slots; and the Mentions list with Provider chip, person, text and age. This adds calendar events, Slots and Signals to the schema and seed, extends the Today read model, and adds the timeline row primitive. The Mention whose Todo is already in the stack is seeded as added and offers no Add. Dragging and Add are drawn and not yet wired.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — awaiting review

- [x] Seed reproduces the mockup's meetings, focus blocks, Slots and Mentions
- [x] Meetings, focus blocks, free hours and slotted Todos each render in their drawn treatment
- [x] Meetings carry no editing affordance
- [x] A Mention already added as a Todo shows as added; the others show Add, disabled for now
- [x] The phone layout follows the phone frame's order: Brief, Take on now, timeline, Priority stack
- [x] Visual diff against frame 1a is noise-only for the whole screen at both widths

## Comments

**2026-09-17 — agent.** Built. `pnpm check`, `typecheck`, `test` (62 tests) and `build` pass. `pnpm visual 1a`: the whole frame reads 0.00% at 1180px and at 390px, with `timeline`, `mentions` and `add a todo` added as regions of their own. Checked in headless Chromium at both widths: no console errors, no sideways page scroll on a phone, a Mention opens when pressed.

How each box was met, where it is not obvious:

- **Schema.** Migration `0003` adds `calendar_event` (a meeting or a focus block, with who it is with as the Provider puts it), `signal` (kind, person, text, when, the Provider item it is, and the Todo it was added as) and `timeline_hour`. Slots were already there from ticket 03.
- **How an hour is drawn is always derived; how it is worded is generated text.** `timeline(stack, events, wording)` in the shared package decides the treatment from what the hour holds: a meeting is a tinted fill, else a focus block is framed, else Slots alone are plainly boxed, else the hour is free and dashed. The frame's wording ("↳ spike continues", "Brief · inbox skim", "Send movers deposit · follow-ups", "carried · 1h") cannot be derived from rows, so it is stored the way the Brief is: a `timeline_hour` row per hour of a day, which the hourly status refresh will write one day. An hour without a row is worded from its Todos and meetings ("Reply to Priya · Book dentist", "quick wins · 20m"; "Prep notes · 1:1 with Devon 16:30", "20m + 30m"), which is what a user's own slotting will show in ticket 08. Both paths are tested at the shared seam.
- **The Today read model returns the day's rows, not the screen.** `readToday` now returns `Today` (Todos, events, hour wording, Mentions, the Brief, the sent-back count) and `viewToday(today, hour)` in the shared package derives the stack, the Take on now, the timeline and the counts. This is for ticket 05: a command applied to the cached `Today` re-derives everything, so completing the Take on now promotes the next Todo with no special case.
- **The seed** has the frame's three meetings and the focus blocks its framed hours imply (09–11, 13, 15), the ten worded hours and the four Mentions with ages that read 17h, 1d, 1d, 2d at 08:41. Priya's Slack message is the Source of "Reply to Priya on edge rate limits", so that Mention is seeded as added. The other three are items of their own at their Providers (Sam's review request is not the HAL-198 issue itself), so they offer Add, as the spec's singular "the Mention" asks.
- **Meetings carry no editing affordance**: a timeline row is text, and assistive technology hears "Meeting:", "Focus block:" or "Free:" before it.
- **`TimelineRow`** and `Timeline` are in `@crazy/ui`. One DOM: on a phone each hour is a 58px cell of a strip that scrolls sideways (the frame clips it), from 900px a row under its hour.

Decisions worth a look:

- **Added and Add sit behind a press**, as carry count and reason do in ticket 03, because frame 1a's Mention rows draw neither and the ticket also asks for a noise-only diff. Pressing a Mention opens "Added to your Todos" or a disabled Add under it. If added Mentions should read differently at a glance, the frame needs a treatment for it.
- **The card is titled "Mentions"**, not "Mentions & follow-ups": the glossary lists "follow-up" as loose talk for all three kinds of Signal, and the card holds Mentions only. The harness draws the frame the same way (`COPY`). Hour 17's "follow-ups" is sample prose and is kept.
- **On a phone, Mentions and add-a-Todo follow the Priority stack.** The phone frame stops at the stack, so that rectangle of the phone comparison is masked with the reason; it is a derived layout, listed in `docs/BRIEF.md`, not a debt.
- **"Drag a todo onto an hour to slot it" is drawn**, and tells assistive technology it is not available yet. The add-a-Todo field is read-only and announced as unavailable, like its button.
- **A completed Todo's hour keeps Crazy's wording** until that hour is re-worded, since nothing regenerates text yet. Ticket 08 should drop an hour's stored wording when the user changes what the hour holds.
- The three focus blocks are my reading of the frame's framed hours; the Brief's "two meetings, both after 11" is kept as drawn beside a calendar of three.
