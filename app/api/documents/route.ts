import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to most recent 50 documents
      select: {
        id: true,
        originalFilename: true,
        status: true,
        errorMessage: true,
        paperlessId: true,
        ocrPageCount: true,
        geminiTokensSent: true,
        geminiTokensRecv: true,
        processingDetails: true,
        createdAt: true,
      },
    });

    // Map originalFilename to filename for client compatibility
    const mappedDocuments = documents.map((doc) => ({
      ...doc,
      filename: doc.originalFilename,
    }));

    return NextResponse.json({ documents: mappedDocuments });
  } catch (error: any) {
    console.error('Failed to get documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get documents' },
      { status: 500 }
    );
  }
}
