import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Gemini test endpoint called');
  try {
    // Try to get from request body first, then fall back to config
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body provided, will use config
    }

    let apiKey = body.geminiApiKey || body.apiKey;
    let model = body.geminiModel || body.model;

    // If not provided in request, try to get from config
    if (!apiKey || !model) {
      const { getConfig, getConfigSecure, CONFIG_KEYS } = await import('@/lib/config');
      if (!apiKey) {
        apiKey = await getConfigSecure(CONFIG_KEYS.GEMINI_API_KEY);
      }
      if (!model) {
        model = await getConfig(CONFIG_KEYS.GEMINI_MODEL);
      }
    }

    console.log('Gemini test request:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      model: model
    });

    if (!apiKey || !model) {
      console.error('Missing fields:', { hasApiKey: !!apiKey, hasModel: !!model });
      return NextResponse.json(
        { error: 'Missing API key or model' },
        { status: 400 }
      );
    }

    // Test prompt for document analysis
    const testPrompt = `You are a document processing assistant. Analyze this sample document and respond with a brief summary.

Document: "Invoice from TechCorp dated January 27, 2026. Total amount: $150.00. Payment due by February 15, 2026."

Provide a JSON response with: { "summary": "...", "actionRequired": true/false }`;

    // Send test request to Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.substring(0, 10)}...`;
    console.log('Calling Gemini API:', geminiUrl);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: testPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          },
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      }
    );

    console.log('Gemini API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);

      let errorMessage = `API returned ${response.status}: ${response.statusText}`;

      try {
        const error = JSON.parse(errorText);
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        console.error('Parsed error message:', errorMessage);
      } catch (e) {
        errorMessage = errorText.substring(0, 300);
        console.error('Failed to parse error, using raw text:', errorMessage);
      }

      const errorResponse = { error: errorMessage };
      console.error('Sending error response:', JSON.stringify(errorResponse));

      return NextResponse.json(errorResponse, { status: response.status });
    }

    const data = await response.json();
    console.log('Gemini API success, tokens used:', data.usageMetadata?.totalTokenCount);

    // Extract response text
    const responseText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response generated';

    // Get token usage if available
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return NextResponse.json({
      success: true,
      response: responseText,
      tokensUsed,
      message: 'Gemini API is working correctly',
    });
  } catch (error: any) {
    console.error('Gemini test exception:', error);
    console.error('Exception details:', error.message, error.name);

    const errorMessage = error.name === 'AbortError' || error.name === 'TimeoutError'
      ? 'Request timeout. Please check your API key and network.'
      : (error.message || 'Failed to test Gemini API');

    const errorResponse = { error: errorMessage };
    console.error('Sending exception response:', JSON.stringify(errorResponse));

    return NextResponse.json(
      errorResponse,
      { status: error.name === 'AbortError' || error.name === 'TimeoutError' ? 408 : 500 }
    );
  }
}
