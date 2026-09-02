/**
 * Messaging persistence facade — mirrors escrow/payments/commerce store selection.
 *
 * firestore-admin: when MESSAGING_USE_FIRESTORE (or commerce/catalog cascade) + credentials
 * memory-disk: local/dev durable JSON under .data/messaging-memory-snapshot.json
 * firestore-misconfigured: requested but credentials missing → fail closed (no silent JSON)
 */

import { hasFirebaseAdminCredentials } from '../../firestoreAdmin';
import {
  conversationMemoryBackend,
  ensureConversationMemoryHydrated,
} from './conversationMemoryBackend';
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

function isMessagingFirestoreRequested(): boolean {
  const raw = process.env.MESSAGING_USE_FIRESTORE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const commerce = process.env.COMMERCE_USE_FIRESTORE?.trim().toLowerCase();
  if (commerce === 'true') return true;
  if (commerce === 'false') return false;
  return process.env.CATALOG_USE_FIRESTORE === 'true';
}

const firestoreRequested = isMessagingFirestoreRequested();
const credentialsOk = hasFirebaseAdminCredentials();
const useAdminFirestore = firestoreRequested && credentialsOk;

if (firestoreRequested && !credentialsOk) {
  console.error(
    '[Messaging] Firestore mode requested but FIREBASE_SERVICE_ACCOUNT_JSON is missing. Fail-closed.',
  );
}

export function getMessagingPersistenceMode():
  | 'firestore-admin'
  | 'memory-disk'
  | 'firestore-misconfigured' {
  if (firestoreRequested && !credentialsOk) return 'firestore-misconfigured';
  return useAdminFirestore ? 'firestore-admin' : 'memory-disk';
}

export function assertMessagingPersistenceReady(): void {
  if (getMessagingPersistenceMode() === 'firestore-misconfigured') {
    throw new Error(
      'Messaging persistence misconfigured: Firestore requested but FIREBASE_SERVICE_ACCOUNT_JSON is not set.',
    );
  }
}

if (!useAdminFirestore && getMessagingPersistenceMode() === 'memory-disk') {
  ensureConversationMemoryHydrated();
}

console.log(`[Messaging] Persistence mode: ${getMessagingPersistenceMode()}`);

async function requireBackend(): Promise<typeof conversationMemoryBackend> {
  assertMessagingPersistenceReady();
  if (useAdminFirestore) {
    const mod = await import('./conversationFirestoreAdmin');
    return mod.conversationFirestoreAdmin as unknown as typeof conversationMemoryBackend;
  }
  return conversationMemoryBackend;
}

export type ConversationStore = typeof conversationMemoryBackend;

/** Sync helper for memory-disk tests only. */
export function resolveConversationStore(): ConversationStore {
  assertMessagingPersistenceReady();
  if (useAdminFirestore) {
    // Callers must use async conversationStore methods under Firestore.
    return conversationMemoryBackend;
  }
  return conversationMemoryBackend;
}

export async function listConversations(): Promise<CommerceConversation[]> {
  return (await requireBackend()).listConversations();
}

export async function getConversation(id: string): Promise<CommerceConversation | null> {
  return (await requireBackend()).getConversation(id);
}

export async function getConversationByReconcileKey(
  key: string,
): Promise<CommerceConversation | null> {
  return (await requireBackend()).getConversationByReconcileKey(key);
}

export async function saveConversation(row: CommerceConversation): Promise<CommerceConversation> {
  return (await requireBackend()).saveConversation(row);
}

export async function listMessages(conversationId: string): Promise<CommerceMessage[]> {
  return (await requireBackend()).listMessages(conversationId);
}

export async function getMessage(id: string): Promise<CommerceMessage | null> {
  return (await requireBackend()).getMessage(id);
}

export async function getMessageByExternalId(
  externalMessageId: string,
): Promise<CommerceMessage | null> {
  return (await requireBackend()).getMessageByExternalId(externalMessageId);
}

export async function saveMessage(row: CommerceMessage): Promise<CommerceMessage> {
  return (await requireBackend()).saveMessage(row);
}

export async function saveAttachment(row: CommerceAttachment): Promise<CommerceAttachment> {
  return (await requireBackend()).saveAttachment(row);
}

export async function getAttachment(id: string): Promise<CommerceAttachment | null> {
  return (await requireBackend()).getAttachment(id);
}

export async function listAttachmentsForMessage(
  messageId: string,
): Promise<CommerceAttachment[]> {
  return (await requireBackend()).listAttachmentsForMessage(messageId);
}

export async function saveSocialInbox(row: SocialInboxConnection): Promise<SocialInboxConnection> {
  return (await requireBackend()).saveSocialInbox(row);
}

export async function listSocialInbox(brandId?: string): Promise<SocialInboxConnection[]> {
  return (await requireBackend()).listSocialInbox(brandId);
}

export async function saveSupportTicket(row: SupportTicket): Promise<SupportTicket> {
  return (await requireBackend()).saveSupportTicket(row);
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  return (await requireBackend()).listSupportTickets();
}

export async function getSupportTicket(id: string): Promise<SupportTicket | null> {
  return (await requireBackend()).getSupportTicket(id);
}

export async function saveAdminEntry(row: AdminConversationEntry): Promise<AdminConversationEntry> {
  return (await requireBackend()).saveAdminEntry(row);
}

export async function listAdminEntries(conversationId?: string): Promise<AdminConversationEntry[]> {
  return (await requireBackend()).listAdminEntries(conversationId);
}

export async function saveSupportNote(row: SupportTicketNote): Promise<SupportTicketNote> {
  return (await requireBackend()).saveSupportNote(row);
}
export async function listSupportNotes(conversationId?: string): Promise<SupportTicketNote[]> {
  return (await requireBackend()).listSupportNotes(conversationId);
}
export async function saveSupportFollowup(row: SupportFollowup): Promise<SupportFollowup> {
  return (await requireBackend()).saveSupportFollowup(row);
}
export async function listSupportFollowups(conversationId?: string): Promise<SupportFollowup[]> {
  return (await requireBackend()).listSupportFollowups(conversationId);
}
