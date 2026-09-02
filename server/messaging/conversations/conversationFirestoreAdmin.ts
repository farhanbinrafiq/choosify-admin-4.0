/**
 * Messaging Firestore Admin adapter — same shape as conversationMemoryBackend.
 */

import {
  getDocumentById,
  listCollection,
  requireAdminFirestore,
  upsertDocumentById,
} from '../../lib/firestore/queryHelpers';
import {
  MESSAGING_ADMIN_ENTRIES,
  MESSAGING_ATTACHMENTS,
  MESSAGING_CONVERSATIONS,
  MESSAGING_MESSAGES,
  MESSAGING_SOCIAL_INBOX,
  MESSAGING_SUPPORT_TICKETS,
  MESSAGING_SUPPORT_NOTES,
  MESSAGING_SUPPORT_FOLLOWUPS,
} from './conversationCollections';
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

export const conversationFirestoreAdmin = {
  listConversations: async (): Promise<CommerceConversation[]> => {
    return listCollection<CommerceConversation>(MESSAGING_CONVERSATIONS);
  },

  getConversation: async (id: string): Promise<CommerceConversation | null> => {
    return getDocumentById<CommerceConversation>(MESSAGING_CONVERSATIONS, id);
  },

  getConversationByReconcileKey: async (key: string): Promise<CommerceConversation | null> => {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_CONVERSATIONS)
      .where('reconcileKey', '==', key)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommerceConversation;
  },

  saveConversation: async (row: CommerceConversation): Promise<CommerceConversation> => {
    await upsertDocumentById(MESSAGING_CONVERSATIONS, row.id, row);
    return row;
  },

  listMessages: async (conversationId: string): Promise<CommerceMessage[]> => {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_MESSAGES)
      .where('conversationId', '==', conversationId)
      .get();
    return snap.docs
      .map((d) => d.data() as CommerceMessage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  getMessage: async (id: string): Promise<CommerceMessage | null> => {
    return getDocumentById<CommerceMessage>(MESSAGING_MESSAGES, id);
  },

  getMessageByExternalId: async (externalMessageId: string): Promise<CommerceMessage | null> => {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_MESSAGES)
      .where('externalMessageId', '==', externalMessageId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommerceMessage;
  },

  saveMessage: async (row: CommerceMessage): Promise<CommerceMessage> => {
    await upsertDocumentById(MESSAGING_MESSAGES, row.id, row);
    return row;
  },

  saveAttachment: async (row: CommerceAttachment): Promise<CommerceAttachment> => {
    await upsertDocumentById(MESSAGING_ATTACHMENTS, row.id, row);
    return row;
  },

  getAttachment: async (id: string): Promise<CommerceAttachment | null> => {
    return getDocumentById<CommerceAttachment>(MESSAGING_ATTACHMENTS, id);
  },

  listAttachmentsForMessage: async (messageId: string): Promise<CommerceAttachment[]> => {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_ATTACHMENTS)
      .where('messageId', '==', messageId)
      .get();
    return snap.docs.map((d) => d.data() as CommerceAttachment);
  },

  saveSocialInbox: async (row: SocialInboxConnection): Promise<SocialInboxConnection> => {
    await upsertDocumentById(MESSAGING_SOCIAL_INBOX, row.id, row);
    return row;
  },

  listSocialInbox: async (brandId?: string): Promise<SocialInboxConnection[]> => {
    if (!brandId) {
      return listCollection<SocialInboxConnection>(MESSAGING_SOCIAL_INBOX);
    }
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_SOCIAL_INBOX)
      .where('brandId', '==', brandId)
      .get();
    return snap.docs.map((d) => d.data() as SocialInboxConnection);
  },

  saveSupportTicket: async (row: SupportTicket): Promise<SupportTicket> => {
    await upsertDocumentById(MESSAGING_SUPPORT_TICKETS, row.id, row);
    return row;
  },

  listSupportTickets: async (): Promise<SupportTicket[]> => {
    return listCollection<SupportTicket>(MESSAGING_SUPPORT_TICKETS);
  },

  getSupportTicket: async (id: string): Promise<SupportTicket | null> => {
    return getDocumentById<SupportTicket>(MESSAGING_SUPPORT_TICKETS, id);
  },

  saveAdminEntry: async (row: AdminConversationEntry): Promise<AdminConversationEntry> => {
    await upsertDocumentById(MESSAGING_ADMIN_ENTRIES, row.id, row);
    return row;
  },

  listAdminEntries: async (conversationId?: string): Promise<AdminConversationEntry[]> => {
    if (!conversationId) {
      return listCollection<AdminConversationEntry>(MESSAGING_ADMIN_ENTRIES);
    }
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_ADMIN_ENTRIES)
      .where('conversationId', '==', conversationId)
      .get();
    return snap.docs.map((d) => d.data() as AdminConversationEntry);
  },

  saveSupportNote: async (row: SupportTicketNote): Promise<SupportTicketNote> => {
    await upsertDocumentById(MESSAGING_SUPPORT_NOTES, row.id, row);
    return row;
  },
  listSupportNotes: async (conversationId?: string): Promise<SupportTicketNote[]> => {
    if (!conversationId) return listCollection<SupportTicketNote>(MESSAGING_SUPPORT_NOTES);
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_SUPPORT_NOTES)
      .where('conversationId', '==', conversationId)
      .get();
    return snap.docs
      .map((d) => d.data() as SupportTicketNote)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  saveSupportFollowup: async (row: SupportFollowup): Promise<SupportFollowup> => {
    await upsertDocumentById(MESSAGING_SUPPORT_FOLLOWUPS, row.id, row);
    return row;
  },
  listSupportFollowups: async (conversationId?: string): Promise<SupportFollowup[]> => {
    if (!conversationId) return listCollection<SupportFollowup>(MESSAGING_SUPPORT_FOLLOWUPS);
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(MESSAGING_SUPPORT_FOLLOWUPS)
      .where('conversationId', '==', conversationId)
      .get();
    return snap.docs.map((d) => d.data() as SupportFollowup);
  },
};
