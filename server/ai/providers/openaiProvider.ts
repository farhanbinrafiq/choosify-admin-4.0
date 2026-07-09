import type { AIProvider } from './aiProvider';
import type { AiProviderRequest, AiProviderResponse } from '../types';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async generate(_request: AiProviderRequest): Promise<AiProviderResponse> {
    throw new Error('OpenAI provider is not implemented. Use AI_PROVIDER=gemini or add an OpenAI adapter.');
  }
}
