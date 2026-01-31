import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Import testStore from start route
let testStore: Map<string, any>;

// Lazy load testStore
async function getTestStore() {
  if (!testStore) {
    const startModule = await import('../../start/route');
    testStore = startModule.testStore;
  }
  return testStore;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
  try {
    const { testId } = params;
    const store = await getTestStore();
    const testStatus = store.get(testId);

    if (!testStatus) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(testStatus);
  } catch (error: any) {
    console.error('Failed to get test status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
