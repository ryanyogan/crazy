-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_timeline_hour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "sourceKind" TEXT,
    "writtenFor" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL
);
INSERT INTO "new_timeline_hour" ("createdAt", "day", "hour", "id", "note", "sourceKind", "title", "userId") SELECT "createdAt", "day", "hour", "id", "note", "sourceKind", "title", "userId" FROM "timeline_hour";
DROP TABLE "timeline_hour";
ALTER TABLE "new_timeline_hour" RENAME TO "timeline_hour";
CREATE UNIQUE INDEX "timeline_hour_userId_day_hour_key" ON "timeline_hour"("userId", "day", "hour");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

