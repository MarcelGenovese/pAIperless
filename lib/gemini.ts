import { getConfig, CONFIG_KEYS } from './config';

export interface GeminiResponse {
  title?: string;
  tags?: string[];
  correspondent?: string | null;
  document_type?: string | null;
  storage_path?: string | null;
  custom_fields?: Record<string, any>;
}

export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyzeDocument(prompt: string): Promise<{
    response: GeminiResponse;
    tokensUsed: { input: number; output: number };
  }> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt,
              }],
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response
      let parsedResponse: GeminiResponse = {};
      try {
        // Try to find JSON in the response (in case there's markdown or other text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          parsedResponse = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON:', text);
        throw new Error('Invalid JSON response from Gemini');
      }

      // Extract token usage
      const tokensUsed = {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0,
      };

      return {
        response: parsedResponse,
        tokensUsed,
      };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }
}

export async function getGeminiClient(): Promise<GeminiClient> {
  const apiKey = await getConfig(CONFIG_KEYS.GEMINI_API_KEY);
  const model = await getConfig(CONFIG_KEYS.GEMINI_MODEL);

  if (!apiKey || !model) {
    throw new Error('Gemini not configured');
  }

  return new GeminiClient(apiKey, model);
}
