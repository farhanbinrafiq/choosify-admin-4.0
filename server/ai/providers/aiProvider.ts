import type { AiProviderName, AiProviderRequest, AiProviderResponse } from '../types';

export interface AIProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}
