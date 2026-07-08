import type { Agent, Conversation, Customer, UnifiedMessage } from '../../src/types';
import { getAdminFirestore } from '../firebaseAdmin';
import type { OrderedListOptions } from '../lib/firestore/queryHelpers';
import {
  collectionHasDocuments,
  existsWhere,
  getDocumentById,
  getLatestWhere,
  listOrdered,
  listWhereOrdered,
} from '../lib/firestore/queryHelpers';
import { snapToData } from '../lib/firestore/documentHelpers';

type StoreBackend = 'admin' | 'memory';

const memory = {
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, UnifiedMessage>(),
  agents: new Map<string, Agent>(),
  customers: new Map<string, Customer>(),
};

let backend: StoreBackend | null = null;

async function resolveBackend(): Promise<StoreBackend> {
  if (backend) return backend;
  const adminDb = await getAdminFirestore();
  backend = adminDb ? 'admin' : 'memory';
  console.log(`[OmniStore] Using ${backend} backend`);
  return backend;
}

export async function getStoreBackend(): Promise<StoreBackend> {
  return resolveBackend();
}

export async function hasConversationData(): Promise<boolean> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return memory.conversations.size > 0;
  }
  return collectionHasDocuments('omni_conversations', 1);
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.customers.set(customer.id, customer);
    return;
  }
  const db = await getAdminFirestore();
  await db!.collection('omni_customers').doc(customer.id).set(customer);
}

export async function saveAgent(agent: Agent): Promise<void> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.agents.set(agent.id, agent);
    return;
  }
  const db = await getAdminFirestore();
  await db!.collection('omni_agents').doc(agent.id).set(agent);
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.conversations.set(conversation.conversationId, conversation);
    return;
  }
  const db = await getAdminFirestore();
  await db!.collection('omni_conversations').doc(conversation.conversationId).set(conversation, { merge: true });
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return memory.conversations.get(conversationId) ?? null;
  }
  return getDocumentById<Conversation>('omni_conversations', conversationId);
}

export async function listConversations(
  options?: OrderedListOptions,
): Promise<Conversation[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    const rows = Array.from(memory.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!options?.limit) return rows;
    return rows.slice(0, options.limit);
  }

  return listOrdered<Conversation>('omni_conversations', 'updatedAt', {
    direction: 'desc',
    ...options,
  });
}

export async function saveMessage(message: UnifiedMessage): Promise<void> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.messages.set(message.id, message);
    return;
  }
  const db = await getAdminFirestore();
  await db!.collection('omni_messages').doc(message.id).set(message);
}

export async function messageExistsByPlatformId(platformMessageId: string): Promise<boolean> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return Array.from(memory.messages.values()).some((m) => m.platformMessageId === platformMessageId);
  }
  return existsWhere('omni_messages', 'platformMessageId', '==', platformMessageId);
}

export async function listMessages(
  conversationId: string,
  options?: OrderedListOptions,
): Promise<UnifiedMessage[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    const rows = Array.from(memory.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (!options?.limit) return rows;
    return rows.slice(0, options.limit);
  }

  return listWhereOrdered<UnifiedMessage>(
    'omni_messages',
    [{ field: 'conversationId', operator: '==', value: conversationId }],
    'timestamp',
    { direction: 'asc', ...options },
  );
}

export async function getLatestInboundMessage(conversationId: string): Promise<UnifiedMessage | null> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    const inbound = Array.from(memory.messages.values())
      .filter((m) => m.conversationId === conversationId && m.direction === 'inbound')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return inbound[0] ?? null;
  }

  return getLatestWhere<UnifiedMessage>(
    'omni_messages',
    [
      { field: 'conversationId', operator: '==', value: conversationId },
      { field: 'direction', operator: '==', value: 'inbound' },
    ],
    'timestamp',
  );
}

export async function listAgents(): Promise<Agent[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return Array.from(memory.agents.values());
  }
  const db = await getAdminFirestore();
  const snap = await db!.collection('omni_agents').get();
  return snap.docs.map((doc) => snapToData(doc) as Agent);
}

export async function patchConversation(
  conversationId: string,
  patch: Partial<Conversation>,
): Promise<Conversation | null> {
  const existing = await getConversation(conversationId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await saveConversation(updated);
  return updated;
}

/** Dev-only: expose memory store for tests */
export function __resetMemoryStoreForTests() {
  memory.conversations.clear();
  memory.messages.clear();
  memory.agents.clear();
  memory.customers.clear();
  backend = null;
}
