/**
 * Messaging memory-disk backend (local/dev) — mirrors escrow pattern.
 */

import {
  flushConversationMemoryPersist,
  loadConversationMemorySnapshot,
  scheduleConversationMemoryPersist,
  type ConversationMemorySnapshot,
} from './conversationPersistence';
import type {
  AdminConversationEntry,
  CommerceAttachment,
  CommerceConversation,
  CommerceMessage,
  SocialInboxConnection,
  SupportTicket,
  SupportTicketNote,
  SupportFollowup,
} from './types';

const state: {
  conversations: CommerceConversation[];
  messages: CommerceMessage[];
  attachments: CommerceAttachment[];
  socialInbox: SocialInboxConnection[];
  supportTickets: SupportTicket[];
  adminEntries: AdminConversationEntry[];
  supportNotes: SupportTicketNote[];
  supportFollowups: SupportFollowup[];
} = {
  conversations: [],
  messages: [],
  attachments: [],
  socialInbox: [],
  supportTickets: [],
  adminEntries: [],
  supportNotes: [],
  supportFollowups: [],
};

let hydrated = false;

function buildSnapshot(): ConversationMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    conversations: state.conversations,
    messages: state.messages,
    attachments: state.attachments,
    socialInbox: state.socialInbox,
    supportTickets: state.supportTickets,
    adminEntries: state.adminEntries,
    supportNotes: state.supportNotes,
    supportFollowups: state.supportFollowups,
  };
}

function schedulePersist(): void {
  scheduleConversationMemoryPersist(buildSnapshot);
}

function upsertById<T>(arr: T[], row: T, idOf: (r: T) => string): T {
  const id = idOf(row);
  const idx = arr.findIndex((r) => idOf(r) === id);
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);
  schedulePersist();
  return row;
}

export function ensureConversationMemoryHydrated(): boolean {
  if (hydrated) return true;
  hydrated = true;
  const snapshot = loadConversationMemorySnapshot();
  if (!snapshot) return false;
  state.conversations = (snapshot.conversations as CommerceConversation[]) || [];
  state.messages = (snapshot.messages as CommerceMessage[]) || [];
  state.attachments = (snapshot.attachments as CommerceAttachment[]) || [];
  state.socialInbox = (snapshot.socialInbox as SocialInboxConnection[]) || [];
  state.supportTickets = (snapshot.supportTickets as SupportTicket[]) || [];
  state.adminEntries = (snapshot.adminEntries as AdminConversationEntry[]) || [];
  state.supportNotes = (snapshot.supportNotes as SupportTicketNote[]) || [];
  state.supportFollowups = (snapshot.supportFollowups as SupportFollowup[]) || [];
  console.log(
    `[MessagingMemoryPersist] Hydrated (${state.conversations.length} conversations, ${state.messages.length} messages).`,
  );
  return true;
}

export function conversationMemoryFlushNow(): void {
  pendingBuildForce();
}

function pendingBuildForce(): void {
  scheduleConversationMemoryPersist(buildSnapshot);
  flushConversationMemoryPersist();
}

export const conversationMemoryBackend = {
  listConversations: async (): Promise<CommerceConversation[]> => {
    ensureConversationMemoryHydrated();
    return [...state.conversations];
  },
  getConversation: async (id: string): Promise<CommerceConversation | null> => {
    ensureConversationMemoryHydrated();
    return state.conversations.find((c) => c.id === id) || null;
  },
  getConversationByReconcileKey: async (key: string): Promise<CommerceConversation | null> => {
    ensureConversationMemoryHydrated();
    return state.conversations.find((c) => c.reconcileKey === key) || null;
  },
  saveConversation: async (row: CommerceConversation): Promise<CommerceConversation> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.conversations, row, (r) => r.id);
  },
  listMessages: async (conversationId: string): Promise<CommerceMessage[]> => {
    ensureConversationMemoryHydrated();
    return state.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  getMessage: async (id: string): Promise<CommerceMessage | null> => {
    ensureConversationMemoryHydrated();
    return state.messages.find((m) => m.id === id) || null;
  },
  getMessageByExternalId: async (externalMessageId: string): Promise<CommerceMessage | null> => {
    ensureConversationMemoryHydrated();
    return state.messages.find((m) => m.externalMessageId === externalMessageId) || null;
  },
  saveMessage: async (row: CommerceMessage): Promise<CommerceMessage> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.messages, row, (r) => r.id);
  },
  saveAttachment: async (row: CommerceAttachment): Promise<CommerceAttachment> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.attachments, row, (r) => r.id);
  },
  getAttachment: async (id: string): Promise<CommerceAttachment | null> => {
    ensureConversationMemoryHydrated();
    return state.attachments.find((a) => a.id === id) || null;
  },
  listAttachmentsForMessage: async (messageId: string): Promise<CommerceAttachment[]> => {
    ensureConversationMemoryHydrated();
    return state.attachments.filter((a) => a.messageId === messageId);
  },
  saveSocialInbox: async (row: SocialInboxConnection): Promise<SocialInboxConnection> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.socialInbox, row, (r) => r.id);
  },
  listSocialInbox: async (brandId?: string): Promise<SocialInboxConnection[]> => {
    ensureConversationMemoryHydrated();
    return brandId
      ? state.socialInbox.filter((s) => s.brandId === brandId)
      : [...state.socialInbox];
  },
  saveSupportTicket: async (row: SupportTicket): Promise<SupportTicket> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.supportTickets, row, (r) => r.id);
  },
  listSupportTickets: async (): Promise<SupportTicket[]> => {
    ensureConversationMemoryHydrated();
    return [...state.supportTickets];
  },
  getSupportTicket: async (id: string): Promise<SupportTicket | null> => {
    ensureConversationMemoryHydrated();
    return state.supportTickets.find((t) => t.id === id) || null;
  },
  saveAdminEntry: async (row: AdminConversationEntry): Promise<AdminConversationEntry> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.adminEntries, row, (r) => r.id);
  },
  listAdminEntries: async (conversationId?: string): Promise<AdminConversationEntry[]> => {
    ensureConversationMemoryHydrated();
    return conversationId
      ? state.adminEntries.filter((e) => e.conversationId === conversationId)
      : [...state.adminEntries];
  },
  saveSupportNote: async (row: SupportTicketNote): Promise<SupportTicketNote> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.supportNotes, row, (r) => r.id);
  },
  listSupportNotes: async (conversationId?: string): Promise<SupportTicketNote[]> => {
    ensureConversationMemoryHydrated();
    const rows = conversationId
      ? state.supportNotes.filter((n) => n.conversationId === conversationId)
      : [...state.supportNotes];
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  saveSupportFollowup: async (row: SupportFollowup): Promise<SupportFollowup> => {
    ensureConversationMemoryHydrated();
    return upsertById(state.supportFollowups, row, (r) => r.id);
  },
  listSupportFollowups: async (conversationId?: string): Promise<SupportFollowup[]> => {
    ensureConversationMemoryHydrated();
    return conversationId
      ? state.supportFollowups.filter((f) => f.conversationId === conversationId)
      : [...state.supportFollowups];
  },
  /** Test helper — wipe in-memory state (does not delete snapshot file). */
  __resetForTests: (): void => {
    state.conversations = [];
    state.messages = [];
    state.attachments = [];
    state.socialInbox = [];
    state.supportTickets = [];
    state.adminEntries = [];
    state.supportNotes = [];
    state.supportFollowups = [];
    hydrated = true;
    schedulePersist();
  },
};
