import type { Request } from 'express';
import { getAiConfig } from './config';
import { buildCombinedContext } from './context/contextBuilder';
import {
  appendMessage,
  buildConversationMemoryBlock,
  createConversation,
  getConversation,
} from './conversation/conversationManager';
import {
  logAiAudit,
  recordAiChat,
  recordAiError,
  recordAiRequest,
  recordAiSkillExecuted,
} from './eventHooks';
import { getPrompt } from './promptRegistry';
import { getAiProvider, listProviderStatus } from './providers/providerFactory';
import { validatePromptInput, validatePromptOutput, withRetry } from './safety/safetyLayer';
import { getSkill, listSkills } from './skills/skillRegistry';
import type {
  AiChatInput,
  AiChatOutput,
  AiExplainability,
  AiPlatformStatus,
  AiSkillId,
  AiSkillInput,
  AiSkillOutput,
  ContextSource,
} from './types';

type ExecuteOptions = {
  req?: Request;
  userId?: string;
};

function ensureEnabled(feature: keyof ReturnType<typeof getAiConfig>['featureFlags']): void {
  const config = getAiConfig();
  if (!config.enabled) throw new Error('AI platform is disabled');
  if (!config.featureFlags[feature]) throw new Error(`AI feature "${feature}" is disabled`);
}

async function runPrompt(input: {
  promptId: string;
  userPrompt: string;
  variables?: Record<string, string>;
  contextSources: ContextSource[];
  contextIds?: Record<string, string>;
  query?: string;
  conversationId?: string;
  skillId?: AiSkillId;
  req?: Request;
  userId?: string;
}): Promise<{ content: string; metadata: AiExplainability }> {
  const config = getAiConfig();
  const provider = getAiProvider();
  if (!provider.isConfigured()) {
    throw new Error(`AI provider "${provider.name}" is not configured`);
  }

  const prompt = getPrompt(input.promptId);
  const inputValidation = validatePromptInput(input.userPrompt);
  if (!inputValidation.passed) {
    throw new Error('AI input failed safety validation');
  }

  const { block, sources } = await buildCombinedContext({
    sources: input.contextSources,
    ids: input.contextIds,
    query: input.query,
  });

  const memoryBlock = buildConversationMemoryBlock(input.conversationId);
  const composedUserPrompt = [
    input.userPrompt,
    block ? `\n\nContext:\n${block}` : '',
    memoryBlock ? `\n\nConversation Memory:\n${memoryBlock}` : '',
  ].join('');

  const started = Date.now();
  recordAiRequest(input.skillId || 'chat', {
    promptId: prompt.id,
    promptVersion: prompt.version,
    contextSources: sources,
  }, input.req);

  const response = await withRetry(() =>
    provider.generate({
      systemPrompt: prompt.systemPrompt,
      userPrompt: composedUserPrompt,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
      timeoutMs: config.timeoutMs,
    }),
  );

  const outputValidation = validatePromptOutput(response.content);
  if (!outputValidation.passed) {
    throw new Error('AI output failed safety validation');
  }

  const executionTimeMs = Date.now() - started;
  const metadata: AiExplainability = {
    provider: provider.name,
    model: response.model,
    promptId: prompt.id,
    promptVersion: prompt.version,
    executionTimeMs,
    safetyChecks: outputValidation,
    contextSources: sources,
    skillId: input.skillId,
    conversationId: input.conversationId,
  };

  logAiAudit('execute_ai_skill', input.skillId || prompt.id, 'success', {
    userId: input.userId,
    executionTimeMs,
    provider: provider.name,
    model: response.model,
    metadata: { promptId: prompt.id, contextSources: sources },
  }, input.req);

  if (input.skillId) {
    recordAiSkillExecuted(input.skillId, {
      promptId: prompt.id,
      executionTimeMs,
      provider: provider.name,
    }, input.req);
  }

  return { content: response.content, metadata };
}

export async function executeSkill(input: AiSkillInput, options: ExecuteOptions = {}): Promise<AiSkillOutput> {
  ensureEnabled('chat');
  const skill = getSkill(input.skillId);
  const variables = input.variables ?? {};
  if (input.message) variables.message = input.message;

  const { block } = await buildCombinedContext({
    sources: input.contextSources ?? skill.contextSources,
    ids: input.contextIds,
    query: variables.query,
  });

  const userPrompt = skill.buildUserPrompt(variables, block);
  const result = await runPrompt({
    promptId: skill.promptId,
    userPrompt,
    variables,
    contextSources: input.contextSources ?? skill.contextSources,
    contextIds: input.contextIds,
    query: variables.query,
    conversationId: input.conversationId,
    skillId: skill.id,
    req: options.req,
    userId: options.userId,
  });

  return {
    skillId: skill.id,
    content: result.content,
    metadata: input.includeMetadata ? result.metadata : undefined,
  };
}

export async function chat(input: AiChatInput, options: ExecuteOptions = {}): Promise<AiChatOutput> {
  ensureEnabled('chat');
  const skillId = input.skillId ?? 'buyer_assistant';
  const conversation =
    (input.conversationId ? getConversation(input.conversationId) : null) ||
    createConversation({
      userId: options.userId,
      skillId,
      contextSources: input.contextSources,
      contextIds: input.contextIds,
    });

  appendMessage(conversation.id, { role: 'user', content: input.message });

  try {
    const result = await executeSkill(
      {
        skillId,
        message: input.message,
        conversationId: conversation.id,
        contextSources: input.contextSources ?? conversation.contextSources,
        contextIds: input.contextIds ?? conversation.contextIds,
        includeMetadata: input.includeMetadata,
      },
      options,
    );

    appendMessage(conversation.id, { role: 'assistant', content: result.content });
    recordAiChat({ conversationId: conversation.id, skillId }, options.req);

    return {
      conversationId: conversation.id,
      reply: result.content,
      metadata: result.metadata,
    };
  } catch (error) {
    recordAiError(skillId, error instanceof Error ? error.message : 'chat failed', options.req);
    throw error;
  }
}

export async function recommend(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('recommend');
  return executeSkill({ ...input, skillId: 'recommend_products' }, options);
}

export async function summarize(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('summarize');
  return executeSkill({ ...input, skillId: 'summarize_product' }, options);
}

export async function compare(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('compare');
  return executeSkill({ ...input, skillId: 'compare_products' }, options);
}

export async function classify(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('classify');
  return executeSkill({ ...input, skillId: 'moderation_assistant' }, options);
}

export async function moderate(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('moderate');
  return executeSkill({ ...input, skillId: 'moderation_assistant' }, options);
}

export async function explain(input: AiSkillInput, options?: ExecuteOptions) {
  ensureEnabled('explain');
  const skillId: AiSkillId =
    input.skillId ||
    (input.contextSources?.includes('trust')
      ? 'trust_explanation'
      : input.contextSources?.includes('analytics')
        ? 'analytics_explainer'
        : 'search_explainer');
  return executeSkill({ ...input, skillId }, options);
}

export function getAiPlatformStatus(): AiPlatformStatus {
  const config = getAiConfig();
  const provider = getAiProvider();
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    configured: provider.isConfigured(),
    featureFlags: config.featureFlags,
    skills: listSkills().map((skill) => skill.id),
    contextSources: ['buyer', 'seller', 'product', 'analytics', 'trust', 'discovery', 'communication', 'search'],
    channels: listProviderStatus(),
  };
}
