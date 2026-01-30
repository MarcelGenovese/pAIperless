import { getConfig, getConfigSecure, CONFIG_KEYS } from './config';
import { createLogger } from './logger';

const logger = createLogger('Gemini');

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

  async analyzeDocument(prompt: string, schema?: any): Promise<{
    response: GeminiResponse;
    tokensUsed: { input: number; output: number };
  }> {
    try {
      const generationConfig: any = {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",  // Force JSON output
      };

      // Add schema if provided
      if (schema) {
        generationConfig.responseSchema = schema;
      }

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
            generationConfig,
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
        // Remove markdown code blocks if present
        let cleanText = text.trim();

        // Remove ```json and ``` markers
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        // Try to find JSON object in the text
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          parsedResponse = JSON.parse(cleanText);
        }
      } catch (parseError) {
        // Log the full response for debugging
        await logger.error('Failed to parse Gemini response as JSON', {
          text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
          fullTextLength: text.length,
          parseError
        });
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
      await logger.error('Error calling Gemini API', error);
      throw error;
    }
  }
}

export async function getGeminiClient(): Promise<GeminiClient> {
  // API Key is stored encrypted, must use getConfigSecure
  const apiKey = await getConfigSecure(CONFIG_KEYS.GEMINI_API_KEY);
  const model = await getConfig(CONFIG_KEYS.GEMINI_MODEL);

  if (!apiKey || !model) {
    throw new Error('Gemini not configured');
  }

  return new GeminiClient(apiKey, model);
}
