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
      .map((model: any) => {
        const modelId = model.name.replace('models/', '');
        return {
          id: modelId,
          name: model.displayName || modelId,
        };
      });

    // Sort to prioritize flash models with gemini-3-flash-preview first
    generationModels.sort((a: any, b: any) => {
      // Prioritize gemini-3-flash-preview first
      if (a.id === 'gemini-3-flash-preview') return -1;
      if (b.id === 'gemini-3-flash-preview') return 1;

      // Then gemini-2.0-flash-exp
      if (a.id === 'gemini-2.0-flash-exp') return -1;
      if (b.id === 'gemini-2.0-flash-exp') return 1;

      // Then other flash models
      if (a.id.includes('flash') && !b.id.includes('flash')) return -1;
      if (!a.id.includes('flash') && b.id.includes('flash')) return 1;

      // Alphabetical for rest
      return a.id.localeCompare(b.id);
    });

    // Add recommended default if API doesn't return it
    if (generationModels.length === 0) {
      generationModels.push({
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
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
