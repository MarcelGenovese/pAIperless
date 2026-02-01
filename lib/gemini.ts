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
        maxOutputTokens: 8192,  // Increased from 2048 to prevent truncated JSON responses
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

        // Remove ```json and ``` markers (case insensitive)
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');

        // Try multiple extraction strategies

        // Strategy 1: Find JSON object with balanced braces
        const jsonMatches = cleanText.match(/\{[\s\S]*\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          // Try to parse each match, take the first valid one
          for (const match of jsonMatches) {
            try {
              const parsed = JSON.parse(match);
              // Verify it looks like our expected response structure
              if (parsed && (parsed.title || parsed.tags || parsed.correspondent)) {
                parsedResponse = parsed;
                break;
              }
            } catch (e) {
              continue; // Try next match
            }
          }

          if (Object.keys(parsedResponse).length === 0 && jsonMatches.length > 0) {
            // If we found matches but couldn't parse any, try the first one anyway
            parsedResponse = JSON.parse(jsonMatches[0]);
          }
        }

        // Strategy 2: Try to parse the entire cleaned text
        if (Object.keys(parsedResponse).length === 0) {
          parsedResponse = JSON.parse(cleanText);
        }
      } catch (parseError) {
        // Log the COMPLETE response for debugging (no truncation)
        await logger.error('❌ Failed to parse Gemini response as JSON');
        await logger.error(`Parse Error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        await logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await logger.error('📄 COMPLETE RAW RESPONSE FROM GEMINI:');
        await logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await logger.error(text); // Log COMPLETE response without truncation
        await logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await logger.error(`Response Length: ${text.length} characters`);
        await logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Create enhanced error with raw response attached
        const error: any = new Error(`Invalid JSON response from Gemini: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        error.rawResponse = text; // Attach raw response for debugging
        throw error;
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
