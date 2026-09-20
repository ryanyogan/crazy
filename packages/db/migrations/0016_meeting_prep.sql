-- What Crazy wrote to prepare a user for one meeting (ticket 28): the few
-- first-person lines the Meetings chapter of Today shows under the event.
-- Generated text with the Brief's standing, so it is stored rather than
-- derived, and a meeting with no row shows no note at all — never a
-- placeholder. Written for a day as the Brief is, because a weekly meeting is
-- prepared for afresh each time it comes round; the read index is (userId, day)
-- because that is how Today asks for them, and every query filters by the user.
--
-- `createdAt` has no default, as no column in this schema does: the moment is
-- handed in by the writer.
--
-- Written by hand from `migration:diff`, less its `DROP INDEX
-- "time_entry_userId_running_key"` (as 0012 to 0015 were): the diff does not
-- know the partial unique index on the Time entries with no end (migration
-- 0011), which is the backstop under "at most one running timer" and stays.

-- CreateTable
CREATE TABLE "meeting_prep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyShort" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "meeting_prep_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendar_event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "meeting_prep_userId_day_idx" ON "meeting_prep"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_prep_userId_calendarEventId_day_key" ON "meeting_prep"("userId", "calendarEventId", "day");
