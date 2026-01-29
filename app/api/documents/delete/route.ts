import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid document IDs' },
        { status: 400 }
      );
    }

    // Delete documents from database
    const deleted = await prisma.document.deleteMany({
      where: {
        id: {
          in: ids.map((id: string) => parseInt(id, 10))
        }
      }
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count
    });
  } catch (error: any) {
    console.error('Delete documents error:', error);
    return NextResponse.json(
      { error: 'Failed to delete documents', detail: error.message },
      { status: 500 }
    );
  }
}
