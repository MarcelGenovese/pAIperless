import { NextRequest, NextResponse } from 'next/server';
import { processAiTodoDocuments } from '@/lib/polling';

export const runtime = 'nodejs';

/**
 * Manual trigger endpoint to process AI_TODO documents
 * This can be used to manually trigger document processing without waiting for polling
 */
export async function POST(request: NextRequest) {
  try {
    const result = await processAiTodoDocuments();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Manual AI Processing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
