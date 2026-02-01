import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST() {
  try {
    // Execute raw SQL to create ProcessLock table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProcessLock" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "lockKey" TEXT NOT NULL,
        "isLocked" INTEGER NOT NULL DEFAULT 0,
        "lockedBy" TEXT,
        "lockedAt" TEXT,
        "lastAccessedAt" TEXT NOT NULL DEFAULT (datetime('now')),
        "progressCurrent" INTEGER,
        "progressTotal" INTEGER,
        "progressMessage" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
        "updatedAt" TEXT NOT NULL
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ProcessLock_lockKey_key" ON "ProcessLock"("lockKey")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ProcessLock_lockKey_idx" ON "ProcessLock"("lockKey")
    `);

    // Test if it works
    const tables = await prisma.$queryRawUnsafe(`
      SELECT name FROM sqlite_master WHERE type='table'
    `);

    return NextResponse.json({
      success: true,
      message: 'ProcessLock table created',
      tables
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
