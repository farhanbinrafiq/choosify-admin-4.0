import type { AIProvider } from './aiProvider';
import type { AiProviderRequest, AiProviderResponse } from '../types';

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude' as const;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  async generate(_request: AiProviderRequest): Promise<AiProviderResponse> {
    throw new Error('Claude provider is not implemented. Use AI_PROVIDER=gemini or add a Claude adapter.');
  }
}
