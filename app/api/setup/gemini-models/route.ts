import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 400 }
      );
    }

    // Fetch available models from Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch models' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter for generation models (not embedding, etc.)
    const generationModels = data.models
      .filter((model: any) =>
        model.supportedGenerationMethods?.includes('generateContent') &&
        (model.name.includes('gemini') || model.name.includes('flash'))
      )
      .map((model: any) => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName || model.name.replace('models/', ''),
        description: model.description,
      }));

    // Add recommended default if API doesn't return it
    if (generationModels.length === 0) {
      generationModels.push({
        name: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash (Experimental)',
        description: 'Latest Flash model with best price-performance',
      });
    }

    return NextResponse.json({
      success: true,
      models: generationModels,
    });
  } catch (error: any) {
    console.error('Failed to fetch Gemini models:', error);

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout. Please check your internet connection.' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
