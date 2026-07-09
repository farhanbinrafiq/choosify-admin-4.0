import { getAiConfig } from '../config';
import type { SafetyCheckResult } from '../types';

const INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /system prompt/i,
  /you are now/i,
  /reveal (your|the) (api|secret|key|password)/i,
  /<\s*script/i,
];

export function validatePromptInput(input: string, maxChars?: number): SafetyCheckResult {
  const config = getAiConfig();
  const limit = maxChars ?? config.maxInputChars;
  const checks: SafetyCheckResult['checks'] = [];

  checks.push({
    name: 'input_length',
    passed: input.length <= limit,
    message: input.length <= limit ? undefined : `Input exceeds ${limit} characters`,
  });

  const injectionDetected = INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  checks.push({
    name: 'prompt_injection',
    passed: !injectionDetected,
    message: injectionDetected ? 'Potential prompt injection detected' : undefined,
  });

  checks.push({
    name: 'non_empty',
    passed: input.trim().length > 0,
    message: input.trim().length > 0 ? undefined : 'Input is empty',
  });

  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}

export function validatePromptOutput(output: string, maxChars?: number): SafetyCheckResult {
  const config = getAiConfig();
  const limit = maxChars ?? config.maxTokens * 4;
  const checks: SafetyCheckResult['checks'] = [];

  checks.push({
    name: 'output_length',
    passed: output.length <= limit,
    message: output.length <= limit ? undefined : `Output exceeds ${limit} characters`,
  });

  checks.push({
    name: 'non_empty',
    passed: output.trim().length > 0,
    message: output.trim().length > 0 ? undefined : 'Output is empty',
  });

  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}

export async function withRetry<T>(fn: () => Promise<T>, retries?: number): Promise<T> {
  const config = getAiConfig();
  const maxAttempts = (retries ?? config.retries) + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI execution failed');
}
