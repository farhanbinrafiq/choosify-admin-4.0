# Unified Communication Platform — ES-011

Centralized communication layer for Choosify notifications, broadcasts, preferences, and future multi-channel delivery. Designed so every communication can eventually flow through this platform without replacing the existing omnichannel messaging hub.

## Architecture

```
Service / Admin Action
  -> notificationService / broadcastService / preferenceService
  -> communicationStore (in-memory)
  -> deliveryChannels abstraction (framework only)
  -> eventHooks
       -> auditAdminAction / auditPermissionChange (ES-006)
       -> recordEventAsync (ES-008)
  -> communicationRouter
       -> /api/notifications/*
       -> /api/admin/notifications
       -> /api/admin/broadcasts
       -> /api/admin/communication
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Types | `communicationTypes.ts` | Notification, broadcast, preference, channel types |
| Store | `communicationStore.ts` | In-memory notifications, broadcasts, preferences |
| Notifications | `notificationService.ts` | CRUD, read/archive/dismiss, bulk ops |
| Broadcasts | `broadcastService.ts` | Admin/seller/buyer broadcasts, role/segment targeting |
| Preferences | `preferenceService.ts` | Channel toggles, quiet hours, digest mode |
| Channels | `deliveryChannels.ts` | Delivery abstraction (no providers implemented) |
| Hooks | `eventHooks.ts` | Audit + analytics integration |
| API | `communicationRouter.ts` | User and admin endpoints |

## Communication Flow

1. **Create** — `createNotification()` stores notification and dispatches to enabled channels.
2. **Deliver** — In-app channel queues immediately; email/push/SMS/WhatsApp/webhook return `unsupported` until providers are wired.
3. **Consume** — Users list/filter notifications via notification center APIs.
4. **Interact** — Mark read, dismiss, archive, or bulk operations.
5. **Broadcast** — Admin creates broadcast; `sendBroadcast()` fans out to target user IDs in metadata.

## Notification Types

`notification`, `announcement`, `broadcast`, `campaign`, `reminder`, `order_update`, `moderation_update`, `seller_update`, `buyer_update`, `system_alert`, `promotion`, `ai_suggestion`

## Categories

`buyer`, `seller`, `admin`, `moderator`, `operations`, `marketing`, `security`, `system`, `ai`

## Priority

`critical`, `high`, `normal`, `low`, `silent`

## Delivery Channels (Framework Only)

| Channel | Status |
|---------|--------|
| `in_app` | Configured — queues in-app delivery |
| `email` | Framework only |
| `push` | Framework only |
| `sms` | Framework only |
| `whatsapp` | Framework only |
| `webhook` | Framework only |

## Preferences

Per-user settings:

- Enable/disable channels
- Quiet hours (`start`, `end`, `enabled`)
- Digest mode: `instant`, `daily`, `weekly`
- Marketing opt-in
- System required (always true for security/system notifications)

## Notification Center Filters

- Unread / read / archived / dismissed / pinned
- Priority, category, type
- Search (`q`)
- Pagination (`limit`, `offset`)

## API Endpoints

### User APIs (authenticated)

| Endpoint | Description |
|----------|-------------|
| `GET /api/notifications` | List user notifications + summary |
| `GET /api/notifications/preferences` | Get preferences |
| `PUT /api/notifications/preferences` | Update preferences |
| `POST /api/notifications/read` | Bulk mark read |
| `POST /api/notifications/archive` | Bulk archive |
| `PATCH /api/notifications/:id/read` | Mark single read |
| `PATCH /api/notifications/:id/unread` | Mark unread |
| `PATCH /api/notifications/:id/dismiss` | Dismiss |
| `PATCH /api/notifications/:id/archive` | Archive |
| `DELETE /api/notifications/:id` | Delete |

### Admin APIs (admin role)

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/notifications` | List notifications (optional `userId`) |
| `POST /api/admin/notifications` | Create notification for user |
| `GET /api/admin/broadcasts` | List broadcasts |
| `POST /api/admin/broadcasts` | Create broadcast |
| `POST /api/admin/broadcasts/:id/send` | Send broadcast |
| `GET /api/admin/communication` | Platform summary + channel status |

## Analytics Integration (ES-008)

| Event | When |
|-------|------|
| `NOTIFICATION_SENT` | Notification created |
| `NOTIFICATION_READ` | Marked read |
| `NOTIFICATION_DISMISSED` | Dismissed |
| `BROADCAST_SENT` | Broadcast sent |
| `EMAIL_OPEN` | Framework hook for future providers |
| `PUSH_OPEN` | Framework hook for future providers |

## Audit Integration (ES-006)

| Action | Audit helper |
|--------|--------------|
| Broadcast creation | `auditAdminAction` |
| Broadcast send | `auditAdminAction` |
| Notification deletion | `auditAdminAction` |
| Preference changes | `auditPermissionChange` |

Notification body content is not logged — only IDs and metadata.

## Future Integrations

- **Email** — Wire `deliveryChannels.email` to SendGrid/SES adapter
- **Push** — FCM/APNs provider behind `push` channel
- **SMS** — Twilio/local gateway behind `sms` channel
- **WhatsApp** — Extend existing Meta adapter from messaging hub
- **Webhook** — Outbound webhook dispatcher for partner systems
- **Messaging hub** — Bridge platform messages to notification center
- **Seller dashboard** — Replace computed notifications with delivered notifications

---

## Migration Report

### Current Messaging

| System | State |
|--------|-------|
| Omnichannel hub | `server/messagingHub.ts` — WhatsApp/Messenger/Instagram/platform |
| Platform messages | `platformMessagingBridge.ts` — order conversations |
| Admin inbox | `Messages.tsx` — Socket.io + REST |
| Admin notifications | `Notifications.tsx` — local mock state only |
| Seller notifications | `sellerIntelligenceService.buildNotifications()` — computed, not delivered |

### Future Communication

| Capability | ES-011 Foundation |
|------------|-------------------|
| Unified notification store | `communicationStore` |
| Notification center APIs | `/api/notifications` |
| User preferences | `/api/notifications/preferences` |
| Admin broadcasts | `/api/admin/broadcasts` |
| Multi-channel framework | `deliveryChannels.ts` |
| Analytics | ES-008 event hooks |
| Audit trail | ES-006 audit hooks |

### Email Migration

1. Implement `EmailChannelProvider` in `deliveryChannels.ts`
2. Route transactional emails (order updates, moderation) through `createNotification()`
3. Respect user preferences except `systemRequired` categories

### Push Migration

1. Implement `PushChannelProvider`
2. Wire mobile/web push tokens to user preferences
3. Record `PUSH_OPEN` via client callback endpoint

### WhatsApp Migration

1. Reuse Meta adapter patterns from `server/messaging/adapters/`
2. Map WhatsApp template messages to `whatsapp` delivery channel
3. Do not replace existing messaging inbox — use for notification delivery only

### Backward Compatibility

- No changes to `messagingHub.ts` routes or Socket.io events
- No Firestore collection changes
- No auth/authorization framework changes
- Existing notification UI untouched (ready for API wiring)
