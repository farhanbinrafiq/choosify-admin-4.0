import type { PromptDefinition } from './types';

const PROMPTS: Record<string, PromptDefinition> = {
  recommend_products_v1: {
    id: 'recommend_products_v1',
    version: '1.0.0',
    category: 'recommendation',
    description: 'Recommend products for a buyer based on context.',
    variables: ['query', 'preferences'],
    systemPrompt:
      'You are Emi, Choosify product recommendation assistant. Suggest relevant products concisely. Use only provided context. Do not invent inventory.',
    temperature: 0.6,
    maxTokens: 800,
  },
  summarize_product_v1: {
    id: 'summarize_product_v1',
    version: '1.0.0',
    category: 'summarization',
    description: 'Summarize a product for shoppers.',
    variables: ['productId'],
    systemPrompt:
      'You are Emi. Summarize the product clearly with key benefits, price context, and availability notes from context only.',
    temperature: 0.5,
    maxTokens: 600,
  },
  compare_products_v1: {
    id: 'compare_products_v1',
    version: '1.0.0',
    category: 'comparison',
    description: 'Compare multiple products.',
    variables: ['productIds'],
    systemPrompt:
      'You are Emi. Compare products objectively using provided attributes. Highlight differences and best fit scenarios.',
    temperature: 0.5,
    maxTokens: 900,
  },
  seller_assistant_v1: {
    id: 'seller_assistant_v1',
    version: '1.0.0',
    category: 'assistant',
    description: 'Assist sellers with operations insights.',
    variables: ['question'],
    systemPrompt:
      'You are Emi seller assistant. Provide actionable seller guidance using only provided seller context.',
    temperature: 0.6,
    maxTokens: 900,
  },
  buyer_assistant_v1: {
    id: 'buyer_assistant_v1',
    version: '1.0.0',
    category: 'assistant',
    description: 'Assist buyers with shopping decisions.',
    variables: ['question'],
    systemPrompt:
      'You are Emi buyer assistant. Help buyers decide using only provided product and discovery context.',
    temperature: 0.6,
    maxTokens: 900,
  },
  analytics_explainer_v1: {
    id: 'analytics_explainer_v1',
    version: '1.0.0',
    category: 'analytics',
    description: 'Explain marketplace analytics summaries.',
    variables: ['question'],
    systemPrompt:
      'You are Emi analytics explainer. Explain metrics plainly for non-technical users. Use only analytics context.',
    temperature: 0.4,
    maxTokens: 800,
  },
  search_explainer_v1: {
    id: 'search_explainer_v1',
    version: '1.0.0',
    category: 'search',
    description: 'Explain search and discovery results.',
    variables: ['query'],
    systemPrompt:
      'You are Emi search explainer. Explain why results may be relevant and suggest refinements using search context only.',
    temperature: 0.5,
    maxTokens: 700,
  },
  review_summary_v1: {
    id: 'review_summary_v1',
    version: '1.0.0',
    category: 'summarization',
    description: 'Summarize product reviews.',
    variables: ['productId'],
    systemPrompt:
      'You are Emi. Summarize review sentiment, recurring themes, and caveats. Do not quote PII.',
    temperature: 0.4,
    maxTokens: 700,
  },
  trust_explanation_v1: {
    id: 'trust_explanation_v1',
    version: '1.0.0',
    category: 'trust',
    description: 'Explain trust and reputation scores.',
    variables: ['entityType', 'entityId'],
    systemPrompt:
      'You are Emi trust explainer. Explain trust/reputation components clearly without revealing private user data.',
    temperature: 0.3,
    maxTokens: 700,
  },
  moderation_assistant_v1: {
    id: 'moderation_assistant_v1',
    version: '1.0.0',
    category: 'moderation',
    description: 'Assist moderators with policy-aware guidance.',
    variables: ['question'],
    systemPrompt:
      'You are Emi moderation assistant. Provide neutral moderation guidance. Never auto-approve or auto-reject.',
    temperature: 0.2,
    maxTokens: 800,
  },
  general_chat_v1: {
    id: 'general_chat_v1',
    version: '1.0.0',
    category: 'general',
    description: 'General Emi assistant chat.',
    variables: ['message'],
    systemPrompt:
      'You are Emi, Choosify AI assistant. Be helpful, concise, and safe. Use provided context only. Refuse harmful requests.',
    temperature: 0.7,
    maxTokens: 1024,
  },
};

export function getPrompt(promptId: string): PromptDefinition {
  const prompt = PROMPTS[promptId];
  if (!prompt) {
    throw new Error(`Unknown prompt: ${promptId}`);
  }
  return prompt;
}

export function listPrompts(): PromptDefinition[] {
  return Object.values(PROMPTS);
}

export function listPromptCategories(): string[] {
  return [...new Set(Object.values(PROMPTS).map((prompt) => prompt.category))];
}
