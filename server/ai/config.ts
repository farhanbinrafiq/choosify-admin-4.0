import { readPositiveIntEnv } from '../lib/env';
import type { AiProviderName } from './types';

function readFloatEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value !== 'false' && value !== '0';
}

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retries: number;
  maxInputChars: number;
  featureFlags: {
    chat: boolean;
    recommend: boolean;
    summarize: boolean;
    compare: boolean;
    explain: boolean;
    classify: boolean;
    moderate: boolean;
  };
};

export function getAiConfig(): AiConfig {
  const provider = (process.env.AI_PROVIDER || 'gemini') as AiProviderName;
  return {
    enabled: readBoolEnv('AI_ENABLED', true),
    provider,
    model: process.env.AI_MODEL || 'gemini-2.0-flash',
    temperature: readFloatEnv('AI_TEMPERATURE', 0.7),
    maxTokens: readPositiveIntEnv('AI_MAX_TOKENS', 1024),
    timeoutMs: readPositiveIntEnv('AI_TIMEOUT_MS', 30000),
    retries: readPositiveIntEnv('AI_RETRIES', 2),
    maxInputChars: readPositiveIntEnv('AI_MAX_INPUT_CHARS', 12000),
    featureFlags: {
      chat: readBoolEnv('AI_FEATURE_CHAT', true),
      recommend: readBoolEnv('AI_FEATURE_RECOMMEND', true),
      summarize: readBoolEnv('AI_FEATURE_SUMMARIZE', true),
      compare: readBoolEnv('AI_FEATURE_COMPARE', true),
      explain: readBoolEnv('AI_FEATURE_EXPLAIN', true),
      classify: readBoolEnv('AI_FEATURE_CLASSIFY', true),
      moderate: readBoolEnv('AI_FEATURE_MODERATE', true),
    },
  };
}
