import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model } = await request.json();

    if (!apiKey || !model) {
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

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          error:
            error.error?.message ||
            `API returned ${response.status}: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

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
    console.error('Gemini test failed:', error);

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout. Please check your API key and network.' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to test Gemini API' },
      { status: 500 }
    );
  }
}
