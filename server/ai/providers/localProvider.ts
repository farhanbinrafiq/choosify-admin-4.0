import type { AIProvider } from './aiProvider';
import type { AiProviderRequest, AiProviderResponse } from '../types';

export class LocalProvider implements AIProvider {
  readonly name = 'local' as const;

  isConfigured(): boolean {
    return Boolean(process.env.AI_LOCAL_ENDPOINT?.trim());
  }

  async generate(_request: AiProviderRequest): Promise<AiProviderResponse> {
    throw new Error('Local model provider is not implemented. Configure AI_LOCAL_ENDPOINT when ready.');
  }
}
