export interface UnifiedMessage {
  id: string;
  platform: 'whatsapp' | 'messenger' | 'instagram' | 'platform';
  platformMessageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: {
    type: 'text' | 'image' | 'file';
    body: string;
    mediaUrl?: string;
  };
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read';
  assignedAgent?: string;
  conversationStatus: 'open' | 'pending' | 'resolved';
  timestamp: string; // ISO String format
  /** Embedded booking-request card snapshot (platform inbox) */
  bookingOffer?: Record<string, unknown>;
}

export interface Conversation {
  conversationId: string; // usually maps to customer platform ID
  platform: 'whatsapp' | 'messenger' | 'instagram' | 'platform';
  senderName: string;
  senderAvatar?: string;
  lastMessage?: string;
  assignedAgent?: string;
  status: 'open' | 'pending' | 'resolved';
  updatedAt: string; // ISO String
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedConversations: string[];
  status: 'active' | 'inactive';
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  platformIds: {
    whatsapp?: string;
    messenger?: string;
    instagram?: string;
  };
}

export interface CategoryType {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  icon: string;
  description: string;
  displayOrder: number;
  enabled: boolean;
}

