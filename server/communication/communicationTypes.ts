export const COMMUNICATION_TYPES = {
  NOTIFICATION: 'notification',
  ANNOUNCEMENT: 'announcement',
  BROADCAST: 'broadcast',
  CAMPAIGN: 'campaign',
  REMINDER: 'reminder',
  ORDER_UPDATE: 'order_update',
  MODERATION_UPDATE: 'moderation_update',
  SELLER_UPDATE: 'seller_update',
  BUYER_UPDATE: 'buyer_update',
  SYSTEM_ALERT: 'system_alert',
  PROMOTION: 'promotion',
  AI_SUGGESTION: 'ai_suggestion',
} as const;

export type CommunicationType = (typeof COMMUNICATION_TYPES)[keyof typeof COMMUNICATION_TYPES];

export const NOTIFICATION_CATEGORIES = {
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  OPERATIONS: 'operations',
  MARKETING: 'marketing',
  SECURITY: 'security',
  SYSTEM: 'system',
  AI: 'ai',
} as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[keyof typeof NOTIFICATION_CATEGORIES];

export const NOTIFICATION_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
  SILENT: 'silent',
} as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[keyof typeof NOTIFICATION_PRIORITIES];

export const DELIVERY_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  WEBHOOK: 'webhook',
} as const;

export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[keyof typeof DELIVERY_CHANNELS];

export const DIGEST_MODES = {
  INSTANT: 'instant',
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const;

export type DigestMode = (typeof DIGEST_MODES)[keyof typeof DIGEST_MODES];

export const BROADCAST_TYPES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  BUYER: 'buyer',
} as const;

export type BroadcastType = (typeof BROADCAST_TYPES)[keyof typeof BROADCAST_TYPES];

export const BROADCAST_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
} as const;

export type BroadcastStatus = (typeof BROADCAST_STATUSES)[keyof typeof BROADCAST_STATUSES];

export type CommunicationNotification = {
  id: string;
  userId: string;
  type: CommunicationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  summary?: string;
  actionUrl?: string;
  channels: DeliveryChannel[];
  read: boolean;
  dismissed: boolean;
  archived: boolean;
  pinned: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  dismissedAt?: string;
  archivedAt?: string;
  expiresAt?: string;
};

export type NotificationInput = {
  userId: string;
  type: CommunicationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  summary?: string;
  actionUrl?: string;
  channels?: DeliveryChannel[];
  pinned?: boolean;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
};

export type NotificationCenterFilter = {
  userId?: string;
  read?: boolean;
  archived?: boolean;
  dismissed?: boolean;
  pinned?: boolean;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  type?: CommunicationType;
  q?: string;
  limit?: number;
  offset?: number;
};

export type CommunicationPreferences = {
  userId: string;
  channels: Record<DeliveryChannel, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  digestMode: DigestMode;
  marketingOptIn: boolean;
  systemRequired: boolean;
  updatedAt: string;
};

export type Broadcast = {
  id: string;
  broadcastType: BroadcastType;
  title: string;
  body: string;
  targetRoles: string[];
  targetSegments: string[];
  createdBy: string;
  status: BroadcastStatus;
  channels: DeliveryChannel[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  scheduledAt?: string;
};

export type BroadcastInput = {
  broadcastType: BroadcastType;
  title: string;
  body: string;
  targetRoles?: string[];
  targetSegments?: string[];
  createdBy: string;
  channels?: DeliveryChannel[];
  status?: BroadcastStatus;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
};

export type CommunicationSummary = {
  notifications: {
    total: number;
    unread: number;
    read: number;
    archived: number;
    pinned: number;
    dismissed: number;
  };
  broadcasts: {
    total: number;
    draft: number;
    scheduled: number;
    sent: number;
  };
  preferences: {
    usersWithPreferences: number;
  };
  generatedAt: string;
};

export type DeliveryDispatchRequest = {
  notificationId: string;
  channel: DeliveryChannel;
  userId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type DeliveryDispatchResult = {
  channel: DeliveryChannel;
  status: 'queued' | 'skipped' | 'unsupported';
  message?: string;
};
