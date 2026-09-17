-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "briefTime" TEXT NOT NULL DEFAULT '06:00',
    "sentBackDays" INTEGER NOT NULL DEFAULT 1,
    "archiveDays" INTEGER NOT NULL DEFAULT 90,
    "billing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL
);

