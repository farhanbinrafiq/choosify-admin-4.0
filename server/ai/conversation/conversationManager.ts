import { randomUUID } from 'crypto';
import type { AiSkillId, ContextSource, ConversationMessage, ConversationSession } from '../types';

const sessions = new Map<string, ConversationSession>();
const MAX_MESSAGES_PER_SESSION = 40;
const MAX_SESSIONS = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function trimSessions(): void {
  if (sessions.size <= MAX_SESSIONS) return;
  const sorted = [...sessions.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const removeCount = sessions.size - MAX_SESSIONS;
  for (let i = 0; i < removeCount; i += 1) {
    sessions.delete(sorted[i].id);
  }
}

export function createConversation(input: {
  userId?: string;
  skillId?: AiSkillId;
  contextSources?: ContextSource[];
  contextIds?: Record<string, string>;
}): ConversationSession {
  const session: ConversationSession = {
    id: `conv-${randomUUID()}`,
    userId: input.userId,
    skillId: input.skillId,
    messages: [],
    contextSources: input.contextSources ?? [],
    contextIds: input.contextIds ?? {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  sessions.set(session.id, session);
  trimSessions();
  return session;
}

export function getConversation(conversationId: string): ConversationSession | null {
  return sessions.get(conversationId) ?? null;
}

export function appendMessage(
  conversationId: string,
  message: Omit<ConversationMessage, 'timestamp'>,
): ConversationSession | null {
  const session = sessions.get(conversationId);
  if (!session) return null;

  session.messages.push({ ...message, timestamp: nowIso() });
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  }
  session.updatedAt = nowIso();
  return session;
}

export function getConversationWindow(conversationId: string, maxMessages = 12): ConversationMessage[] {
  const session = sessions.get(conversationId);
  if (!session) return [];
  return session.messages.slice(-maxMessages);
}

export function buildConversationMemoryBlock(conversationId?: string): string {
  if (!conversationId) return '';
  const window = getConversationWindow(conversationId);
  if (window.length === 0) return '';
  return window.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
}

export function listConversationStats() {
  return {
    activeSessions: sessions.size,
    maxSessions: MAX_SESSIONS,
    maxMessagesPerSession: MAX_MESSAGES_PER_SESSION,
    persistence: 'memory_only',
  };
}
