-- Who Crazy thinks a Time entry's hours were for, where the entry names no
-- Client. The Time screen flags those entries and offers the suggestion as one
-- tap (`timeEntry.confirmSuggestion`); confirming is what puts the Client on.
--
-- Written by hand from `migration:diff`, less its DROP INDEX: the diff does not
-- know the partial unique index on the entries with no end (migration 0011),
-- which is the backstop under "at most one running timer" and stays.

-- AlterTable
ALTER TABLE "time_entry" ADD COLUMN "suggestedClientId" TEXT;
ALTER TABLE "time_entry" ADD COLUMN "suggestedProjectId" TEXT;
