import type { AiSkillDefinition, AiSkillId } from '../types';

export const SKILL_REGISTRY: Record<AiSkillId, AiSkillDefinition> = {
  recommend_products: {
    id: 'recommend_products',
    promptId: 'recommend_products_v1',
    description: 'Recommend products for buyers.',
    contextSources: ['buyer', 'product', 'discovery', 'search'],
    safetyRules: ['no_invented_inventory', 'no_pii_output', 'context_only'],
    outputSchema: { recommendations: 'string', rationale: 'string' },
    buildUserPrompt: (variables, contextBlock) =>
      `Recommend products.\nQuery: ${variables.query || 'general'}\nPreferences: ${variables.preferences || 'none'}\n\nContext:\n${contextBlock}`,
  },
  summarize_product: {
    id: 'summarize_product',
    promptId: 'summarize_product_v1',
    description: 'Summarize a single product.',
    contextSources: ['product'],
    safetyRules: ['context_only', 'no_pii_output'],
    outputSchema: { summary: 'string', highlights: 'string[]' },
    buildUserPrompt: (variables, contextBlock) =>
      `Summarize product ${variables.productId || 'unknown'}.\n\nContext:\n${contextBlock}`,
  },
  compare_products: {
    id: 'compare_products',
    promptId: 'compare_products_v1',
    description: 'Compare multiple products.',
    contextSources: ['product', 'discovery'],
    safetyRules: ['context_only', 'no_pii_output'],
    outputSchema: { comparison: 'string', winner: 'string' },
    buildUserPrompt: (variables, contextBlock) =>
      `Compare products: ${variables.productIds || 'unknown'}.\n\nContext:\n${contextBlock}`,
  },
  seller_assistant: {
    id: 'seller_assistant',
    promptId: 'seller_assistant_v1',
    description: 'Seller operations assistant.',
    contextSources: ['seller', 'analytics', 'communication'],
    safetyRules: ['context_only', 'no_secrets', 'no_pii_output'],
    outputSchema: { answer: 'string', actions: 'string[]' },
    buildUserPrompt: (variables, contextBlock) =>
      `Seller question: ${variables.question || variables.message || ''}\n\nContext:\n${contextBlock}`,
  },
  buyer_assistant: {
    id: 'buyer_assistant',
    promptId: 'buyer_assistant_v1',
    description: 'Buyer shopping assistant.',
    contextSources: ['buyer', 'product', 'discovery', 'search'],
    safetyRules: ['context_only', 'no_pii_output'],
    outputSchema: { answer: 'string', suggestions: 'string[]' },
    buildUserPrompt: (variables, contextBlock) =>
      `Buyer question: ${variables.question || variables.message || ''}\n\nContext:\n${contextBlock}`,
  },
  analytics_explainer: {
    id: 'analytics_explainer',
    promptId: 'analytics_explainer_v1',
    description: 'Explain analytics summaries.',
    contextSources: ['analytics'],
    safetyRules: ['context_only', 'no_pii_output'],
    outputSchema: { explanation: 'string' },
    buildUserPrompt: (variables, contextBlock) =>
      `Explain analytics.\nQuestion: ${variables.question || variables.message || 'overview'}\n\nContext:\n${contextBlock}`,
  },
  search_explainer: {
    id: 'search_explainer',
    promptId: 'search_explainer_v1',
    description: 'Explain search results.',
    contextSources: ['search', 'discovery'],
    safetyRules: ['context_only'],
    outputSchema: { explanation: 'string', refinements: 'string[]' },
    buildUserPrompt: (variables, contextBlock) =>
      `Explain search for: ${variables.query || variables.message || ''}\n\nContext:\n${contextBlock}`,
  },
  review_summary: {
    id: 'review_summary',
    promptId: 'review_summary_v1',
    description: 'Summarize product reviews.',
    contextSources: ['product', 'buyer'],
    safetyRules: ['no_pii_output', 'context_only'],
    outputSchema: { summary: 'string', sentiment: 'string' },
    buildUserPrompt: (variables, contextBlock) =>
      `Summarize reviews for product ${variables.productId || 'unknown'}.\n\nContext:\n${contextBlock}`,
  },
  trust_explanation: {
    id: 'trust_explanation',
    promptId: 'trust_explanation_v1',
    description: 'Explain trust and reputation.',
    contextSources: ['trust'],
    safetyRules: ['no_pii_output', 'context_only'],
    outputSchema: { explanation: 'string', factors: 'object' },
    buildUserPrompt: (variables, contextBlock) =>
      `Explain trust for ${variables.entityType || 'entity'} ${variables.entityId || ''}.\n\nContext:\n${contextBlock}`,
  },
  moderation_assistant: {
    id: 'moderation_assistant',
    promptId: 'moderation_assistant_v1',
    description: 'Moderation guidance assistant.',
    contextSources: ['trust', 'communication'],
    safetyRules: ['no_auto_decisions', 'no_pii_output', 'context_only'],
    outputSchema: { guidance: 'string', risks: 'string[]' },
    buildUserPrompt: (variables, contextBlock) =>
      `Moderation question: ${variables.question || variables.message || ''}\n\nContext:\n${contextBlock}`,
  },
};

export function getSkill(skillId: AiSkillId): AiSkillDefinition {
  const skill = SKILL_REGISTRY[skillId];
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  return skill;
}

export function listSkills(): AiSkillDefinition[] {
  return Object.values(SKILL_REGISTRY);
}
