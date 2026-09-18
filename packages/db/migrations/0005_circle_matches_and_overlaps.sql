-- AlterTable
ALTER TABLE "circle" ADD COLUMN "people" INTEGER;
ALTER TABLE "circle" ADD COLUMN "providers" TEXT;

-- CreateTable
CREATE TABLE "circle_match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "circle_match_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "circle_match_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "overlap_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "people" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "figureTitle" TEXT,
    "figureNote" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "overlap_note_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "circle_match_userId_idx" ON "circle_match"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "circle_match_todoId_circleId_key" ON "circle_match"("todoId", "circleId");

-- CreateIndex
CREATE UNIQUE INDEX "overlap_note_todoId_key" ON "overlap_note"("todoId");

-- CreateIndex
CREATE INDEX "overlap_note_userId_idx" ON "overlap_note"("userId");

