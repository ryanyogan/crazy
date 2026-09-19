-- One Client's bill for one period, and its lines (ticket 21). The arithmetic
-- is `draftInvoice` in @crazy/shared; these rows are what it came to, with the
-- terms copied onto the invoice so that a rate changed in October cannot move
-- September's bill. Every figure is an integer of cents, minutes or seconds.
--
-- A retainer's hours past its budget are charged at `overageRateCents`, which
-- the Client holds beside the retainer rate (Bramble: $180/h over 20h a month,
-- then $200/h) and every invoice copies.
--
-- Written by hand from `migration:diff`, less its DROP INDEX: the diff does not
-- know the partial unique index on the entries with no end (migration 0011),
-- which is the backstop under "at most one running timer" and stays.

-- AlterTable
ALTER TABLE "client" ADD COLUMN "overageRateCents" INTEGER;

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromDay" TEXT NOT NULL,
    "toDay" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedDay" TEXT NOT NULL,
    "dueDay" TEXT NOT NULL,
    "arrangement" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "overageRateCents" INTEGER,
    "roundingMinutes" INTEGER NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL,
    "budgetHours" INTEGER,
    "currency" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectId" TEXT,
    "seconds" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_line_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "invoice_userId_fromDay_idx" ON "invoice"("userId", "fromDay");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_userId_clientId_fromDay_key" ON "invoice"("userId", "clientId", "fromDay");

-- CreateIndex
CREATE INDEX "invoice_line_userId_idx" ON "invoice_line"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_invoiceId_position_key" ON "invoice_line"("invoiceId", "position");
