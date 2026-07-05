import type { Agent, Conversation, Customer, UnifiedMessage } from '../../src/types';
import { getAdminFirestore } from '../firebaseAdmin';

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
  const db = await getAdminFirestore();
  if (!db) return false;
  const snap = await db.collection('omni_conversations').limit(1).get();
  return !snap.empty;
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
  const db = await getAdminFirestore();
  const snap = await db!.collection('omni_conversations').doc(conversationId).get();
  return snap.exists ? (snap.data() as Conversation) : null;
}

export async function listConversations(): Promise<Conversation[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return Array.from(memory.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  const db = await getAdminFirestore();
  const snap = await db!.collection('omni_conversations').orderBy('updatedAt', 'desc').get();
  return snap.docs.map((doc) => doc.data() as Conversation);
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
  const db = await getAdminFirestore();
  const snap = await db!
    .collection('omni_messages')
    .where('platformMessageId', '==', platformMessageId)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function listMessages(conversationId: string): Promise<UnifiedMessage[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return Array.from(memory.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  const db = await getAdminFirestore();
  const snap = await db!
    .collection('omni_messages')
    .where('conversationId', '==', conversationId)
    .orderBy('timestamp', 'asc')
    .get();
  return snap.docs.map((doc) => doc.data() as UnifiedMessage);
}

export async function getLatestInboundMessage(conversationId: string): Promise<UnifiedMessage | null> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    const inbound = Array.from(memory.messages.values())
      .filter((m) => m.conversationId === conversationId && m.direction === 'inbound')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return inbound[0] ?? null;
  }
  const db = await getAdminFirestore();
  const snap = await db!
    .collection('omni_messages')
    .where('conversationId', '==', conversationId)
    .where('direction', '==', 'inbound')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as UnifiedMessage;
}

export async function listAgents(): Promise<Agent[]> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return Array.from(memory.agents.values());
  }
  const db = await getAdminFirestore();
  const snap = await db!.collection('omni_agents').get();
  return snap.docs.map((doc) => doc.data() as Agent);
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
