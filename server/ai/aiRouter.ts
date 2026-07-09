import { Router } from 'express';
import { success } from '../lib/apiResponse';
import { authenticateRequest } from '../middleware/auth';
import {
  chat,
  compare,
  explain,
  getAiPlatformStatus,
  recommend,
  summarize,
} from './aiService';
import type { AiSkillId, ContextSource } from './types';
import { listConversationStats } from './conversation/conversationManager';
import { listPromptCategories, listPrompts } from './promptRegistry';
import { listSkills } from './skills/skillRegistry';

export const aiRouter = Router();

const requireAuth = [authenticateRequest];

const SKILL_IDS: AiSkillId[] = [
  'recommend_products',
  'summarize_product',
  'compare_products',
  'seller_assistant',
  'buyer_assistant',
  'analytics_explainer',
  'search_explainer',
  'review_summary',
  'trust_explanation',
  'moderation_assistant',
];

const CONTEXT_SOURCES: ContextSource[] = [
  'buyer',
  'seller',
  'product',
  'analytics',
  'trust',
  'discovery',
  'communication',
  'search',
];

function parseContextSources(value: unknown): ContextSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is ContextSource => CONTEXT_SOURCES.includes(item as ContextSource));
}

aiRouter.get('/ai/status', ...requireAuth, (_req, res) => {
  return success(res, {
    ...getAiPlatformStatus(),
    prompts: listPrompts().map((prompt) => ({
      id: prompt.id,
      version: prompt.version,
      category: prompt.category,
    })),
    promptCategories: listPromptCategories(),
    skills: listSkills().map((skill) => ({
      id: skill.id,
      promptId: skill.promptId,
      contextSources: skill.contextSources,
    })),
    conversation: listConversationStats(),
  });
});

aiRouter.post('/ai/chat', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const result = await chat(
      {
        message: body.message.trim(),
        skillId: SKILL_IDS.includes(body.skillId) ? body.skillId : undefined,
        conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
        contextSources: parseContextSources(body.contextSources),
        contextIds: typeof body.contextIds === 'object' ? body.contextIds : undefined,
        includeMetadata: body.includeMetadata !== false,
      },
      { req, userId: req.userId || req.user?.uid },
    );

    return success(res, result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI chat failed',
    });
  }
});

aiRouter.post('/ai/recommend', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await recommend(
      {
        skillId: 'recommend_products',
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources),
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false,
      },
      { req, userId: req.userId },
    );
    return success(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'AI recommend failed' });
  }
});

aiRouter.post('/ai/summarize', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await summarize(
      {
        skillId: 'summarize_product',
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources) ?? ['product'],
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false,
      },
      { req, userId: req.userId },
    );
    return success(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'AI summarize failed' });
  }
});

aiRouter.post('/ai/compare', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await compare(
      {
        skillId: 'compare_products',
        variables: body.variables,
        contextSources: parseContextSources(body.contextSources) ?? ['product', 'discovery'],
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false,
      },
      { req, userId: req.userId },
    );
    return success(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'AI compare failed' });
  }
});

aiRouter.post('/ai/explain', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await explain(
      {
        skillId: body.skillId,
        variables: body.variables,
        message: body.message,
        contextSources: parseContextSources(body.contextSources),
        contextIds: body.contextIds,
        includeMetadata: body.includeMetadata !== false,
      },
      { req, userId: req.userId },
    );
    return success(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'AI explain failed' });
  }
});
