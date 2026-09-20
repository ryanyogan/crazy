---
status: accepted
---

# Today is a rundown, and its frames keep only their parts

Frames 1a and 2a draw the Today screen as two columns you work in: the Brief and the Take on now card across the top, the hour timeline on the left, the Priority stack and the cards under it on the right. The owner asked for something else — _"the Today page needs to be more of a rundown or a catch-up, a prep for the day, very pretty, with sections to dive into"_ — so Today is now a short reading column of chapters, each a disclosure whose head is a kicker, a count and one sentence derived from the day's own rows: what arrived while you were away, what each meeting needs from you, whether what is left fits in the day, the shape of the day, where the week has gone with the Billing module on, and what the week is leading to. Closed, the page is the rundown. Open, each chapter holds the working part that already existed — the stack you tick and drag, the hours you slot onto, the Mentions you add — beside a sticky aside that holds Take on now, the place to add a Todo and the index of the chapters. One new drawing is added, the day ribbon: the whole working day on a measured rule, which is the timeline said in a line.

This is an explicit override of "docs/design is frozen, compare against it" for Today's **layout** only. The frames' **parts** stay pixel-faithful and are still compared, one at a time: the harness cuts the frame to a part and cuts the app to the same size where that part now sits (`Part.crop` in `tools/visual/src/targets.ts`). Every sentence on the screen is a pure function in `packages/shared/src/rundown.ts` over the day's rows and the moment, tested there, so no sentence can disagree with the rows under it; the only text on the screen that is stored rather than derived is the Brief and a meeting's prep note (`meeting_prep`), which have the same standing as each other and are never placeholders.

## Consequences

- The whole of frame 1a and the whole of frame 2a stop being comparable, at both widths, and the harness says so where they were. So do the parts of a card that are laid out from its right edge: the Priority stack, the Mentions card and "This week by Client" now sit in a 588px reading column rather than a 340px one, so a Source chip, a timer control, a Mention's age and a Client's bar all fall somewhere else. The rows themselves, the cards' edges and their headings are compared, and `targets.ts` lists what stopped being comparable beside them.
- Every other frame is untouched. This decision is about the Today screen and nothing else; 1c–1g, 2b, 2c, 3a, 3b and 4a stay where they are and must not move.
- Which chapters are open is UI state on the device (`localStorage`), never D1 (ADR 0002): what she closed on her laptop is no business of her phone's.
- A new chapter is a new member of `ChapterName`, a case in `viewRundown` and a case in the screen's `body`. It is not a new write path: nothing in the rundown writes, and starting a timer from a meeting is `timer.start`/`timer.switch` as everywhere else.
