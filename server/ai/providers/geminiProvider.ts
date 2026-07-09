import { GoogleGenAI } from '@google/genai';
import type { AIProvider } from './aiProvider';
import type { AiProviderRequest, AiProviderResponse } from '../types';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return this.getClient() !== null;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Gemini provider is not configured. Set GEMINI_API_KEY.');
    }

    const model = process.env.AI_MODEL || 'gemini-2.0-flash';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await client.models.generateContent({
        model,
        contents: `${request.systemPrompt}\n\n${request.userPrompt}`,
        config: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          abortSignal: controller.signal,
        },
      });

      const content = response.text?.trim() || '';
      if (!content) {
        throw new Error('Gemini returned an empty response');
      }

      return {
        content,
        model,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
