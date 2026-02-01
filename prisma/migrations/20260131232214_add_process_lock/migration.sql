-- CreateTable
CREATE TABLE "ProcessLock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lockKey" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "lockedAt" DATETIME,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressCurrent" INTEGER,
    "progressTotal" INTEGER,
    "progressMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessLock_lockKey_key" ON "ProcessLock"("lockKey");

-- CreateIndex
CREATE INDEX "ProcessLock_lockKey_idx" ON "ProcessLock"("lockKey");
