export type AiProviderName = 'gemini' | 'openai' | 'claude' | 'local';

export type AiSkillId =
  | 'recommend_products'
  | 'summarize_product'
  | 'compare_products'
  | 'seller_assistant'
  | 'buyer_assistant'
  | 'analytics_explainer'
  | 'search_explainer'
  | 'review_summary'
  | 'trust_explanation'
  | 'moderation_assistant';

export type ContextSource =
  | 'buyer'
  | 'seller'
  | 'product'
  | 'analytics'
  | 'trust'
  | 'discovery'
  | 'communication'
  | 'search';

export type PromptCategory =
  | 'recommendation'
  | 'summarization'
  | 'comparison'
  | 'assistant'
  | 'analytics'
  | 'search'
  | 'trust'
  | 'moderation'
  | 'general';

export type PromptDefinition = {
  id: string;
  version: string;
  category: PromptCategory;
  description: string;
  variables: string[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

export type SafetyCheckResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
};

export type AiExplainability = {
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  executionTimeMs: number;
  safetyChecks: SafetyCheckResult;
  contextSources: ContextSource[];
  confidence?: number;
  skillId?: string;
  conversationId?: string;
};

export type AiProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

export type AiProviderResponse = {
  content: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type AiSkillInput = {
  skillId: AiSkillId;
  variables?: Record<string, string>;
  contextSources?: ContextSource[];
  contextIds?: Record<string, string>;
  conversationId?: string;
  message?: string;
  includeMetadata?: boolean;
};

export type AiSkillOutput = {
  skillId: AiSkillId;
  content: string;
  structured?: Record<string, unknown>;
  metadata?: AiExplainability;
};

export type AiChatInput = {
  message: string;
  skillId?: AiSkillId;
  conversationId?: string;
  contextSources?: ContextSource[];
  contextIds?: Record<string, string>;
  includeMetadata?: boolean;
};

export type AiChatOutput = {
  conversationId: string;
  reply: string;
  metadata?: AiExplainability;
};

export type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

export type ConversationSession = {
  id: string;
  userId?: string;
  skillId?: AiSkillId;
  messages: ConversationMessage[];
  contextSources: ContextSource[];
  contextIds: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type AiPlatformStatus = {
  enabled: boolean;
  provider: AiProviderName;
  model: string;
  configured: boolean;
  featureFlags: Record<string, boolean>;
  skills: string[];
  contextSources: ContextSource[];
  channels: { provider: string; configured: boolean }[];
};

export type AiSkillDefinition = {
  id: AiSkillId;
  promptId: string;
  description: string;
  contextSources: ContextSource[];
  safetyRules: string[];
  outputSchema: Record<string, string>;
  buildUserPrompt: (variables: Record<string, string>, contextBlock: string) => string;
};
