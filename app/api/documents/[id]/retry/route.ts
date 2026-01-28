import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'ERROR') {
      return NextResponse.json(
        { error: 'Document is not in ERROR state' },
        { status: 400 }
      );
    }

    // Reset document status to PENDING for retry
    await prisma.document.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document queued for retry',
    });
  } catch (error: any) {
    console.error('Failed to retry document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retry document' },
      { status: 500 }
    );
  }
}
