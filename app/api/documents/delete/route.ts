import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, documentId } = body;

    // Accept both 'ids' (array) and 'documentId' (single) formats
    let documentIds: number[];

    if (documentId !== undefined) {
      // Single document ID
      documentIds = [typeof documentId === 'number' ? documentId : parseInt(documentId, 10)];
    } else if (ids && Array.isArray(ids)) {
      // Array of document IDs
      documentIds = ids.map((id: string | number) => typeof id === 'number' ? id : parseInt(id, 10));
    } else {
      return NextResponse.json(
        { error: 'Invalid document IDs' },
        { status: 400 }
      );
    }

    if (documentIds.length === 0) {
      return NextResponse.json(
        { error: 'No document IDs provided' },
        { status: 400 }
      );
    }

    // Delete documents from database
    const deleted = await prisma.document.deleteMany({
      where: {
        id: {
          in: documentIds
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
