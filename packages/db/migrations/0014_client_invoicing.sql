-- How each Client is billed, beyond the terms of the work itself (ticket 23,
-- frame 2c): whether Crazy puts their next invoice together when the cadence
-- comes due, and whether such an invoice may go out without being read first.
--
-- Both are NOT NULL DEFAULT false, so every Client that already exists has
-- them off: sending without review is a thing a person turns on, per Client,
-- and never a thing they find already on. A constant default is not a clock
-- default, which is the thing this schema does not allow.
--
-- Written by hand from `migration:diff`, less its DROP INDEX: the diff does not
-- know the partial unique index on the entries with no end (migration 0011),
-- which is the backstop under "at most one running timer" and stays. The diff
-- also wanted to redefine the whole table behind two PRAGMAs, which is how
-- Prisma adds a column in the middle of a SQLite table; two ADD COLUMNs put
-- the same two columns on the end and leave every row and foreign key alone.

-- AlterTable
ALTER TABLE "client" ADD COLUMN "autoDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client" ADD COLUMN "sendWithoutReview" BOOLEAN NOT NULL DEFAULT false;
