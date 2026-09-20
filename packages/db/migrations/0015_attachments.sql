-- The Attachment metadata (ticket 24): a file a user deliberately added to a
-- Todo. The bytes live in the R2 bucket under a key derived from the owner,
-- the Todo and this row's id (`attachmentKey` in @crazy/shared); this row is
-- the only way to find them. `key` is unique, so one key is one Attachment,
-- and the read index is (userId, todoId) because that is how a Todo's files
-- are ever asked for — and every query filters by the user.
--
-- `createdAt` has no default, as no column in this schema does: the moment is
-- handed in by the writer.
--
-- Written by hand from `migration:diff`, less its `DROP INDEX
-- "time_entry_userId_running_key"` (as 0012, 0013 and 0014 were): the diff does
-- not know the partial unique index on the Time entries with no end (migration
-- 0011), which is the backstop under "at most one running timer" and stays.

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "attachment_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "attachment_key_key" ON "attachment"("key");

-- CreateIndex
CREATE INDEX "attachment_userId_todoId_idx" ON "attachment"("userId", "todoId");
