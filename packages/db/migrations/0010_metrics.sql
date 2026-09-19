-- CreateTable
CREATE TABLE "metric_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "figure" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "metric_snapshot_userId_range_day_idx" ON "metric_snapshot"("userId", "range", "day");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshot_userId_range_day_kind_figure_position_key" ON "metric_snapshot"("userId", "range", "day", "kind", "figure", "position");

-- CreateIndex
CREATE INDEX "todo_userId_state_touchedAt_idx" ON "todo"("userId", "state", "touchedAt");

-- CreateIndex
CREATE INDEX "todo_userId_createdAt_idx" ON "todo"("userId", "createdAt");

