import { getAiConfig } from '../config';
import type { AIProvider } from './aiProvider';
import { ClaudeProvider } from './claudeProvider';
import { GeminiProvider } from './geminiProvider';
import { LocalProvider } from './localProvider';
import { OpenAIProvider } from './openaiProvider';

const providers: Record<string, AIProvider> = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
  local: new LocalProvider(),
};

export function getAiProvider(): AIProvider {
  const config = getAiConfig();
  return providers[config.provider] ?? providers.gemini;
}

export function listProviderStatus(): Array<{ provider: string; configured: boolean }> {
  return Object.values(providers).map((provider) => ({
    provider: provider.name,
    configured: provider.isConfigured(),
  }));
}
