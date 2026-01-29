-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CostTracking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "documentAIPages" INTEGER NOT NULL DEFAULT 0,
    "documentAIPagesLimit" INTEGER NOT NULL DEFAULT 5000,
    "geminiTokensSent" INTEGER NOT NULL DEFAULT 0,
    "geminiTokensReceived" INTEGER NOT NULL DEFAULT 0,
    "geminiTokensLimit" INTEGER NOT NULL DEFAULT 1000000,
    "estimatedCost" REAL NOT NULL DEFAULT 0.0,
    "lastUpdated" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CostTracking" ("createdAt", "documentAIPages", "documentAIPagesLimit", "estimatedCost", "geminiTokensReceived", "geminiTokensSent", "id", "lastUpdated", "month") SELECT "createdAt", "documentAIPages", "documentAIPagesLimit", "estimatedCost", "geminiTokensReceived", "geminiTokensSent", "id", "lastUpdated", "month" FROM "CostTracking";
DROP TABLE "CostTracking";
ALTER TABLE "new_CostTracking" RENAME TO "CostTracking";
CREATE UNIQUE INDEX "CostTracking_month_key" ON "CostTracking"("month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
