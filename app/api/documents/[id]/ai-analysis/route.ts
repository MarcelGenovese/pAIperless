import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    // Get document info
    const document = await prisma.document.findUnique({
      where: { id: parseInt(documentId) },
      select: {
        id: true,
        originalFilename: true,
        paperlessId: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get AI analysis logs for this document
    const logs = await prisma.log.findMany({
      where: {
        OR: [
          {
            message: {
              contains: `Document ${documentId}`,
            },
          },
          {
            message: {
              contains: `document ${documentId}`,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse logs and extract AI analysis information
    const analyses = logs.map((log) => {
      let meta: any = {};
      try {
        if (log.meta) {
          meta = JSON.parse(log.meta);
        }
      } catch (e) {
        // Ignore parse errors
      }

      return {
        id: log.id,
        level: log.level,
        message: log.message,
        tokensInput: meta.tokensInput || 0,
        tokensOutput: meta.tokensOutput || 0,
        tokensTotal: meta.tokensTotal || 0,
        error: meta.error || null,
        createdAt: log.createdAt,
      };
    });

    return NextResponse.json({
      document,
      analyses,
    });
  } catch (error: any) {
    console.error('Failed to get AI analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI analysis' },
      { status: 500 }
    );
  }
}
