/**
 * Detects whether the omni Firestore mirror (the collection every
 * client-side onSnapshot listener in this app subscribes to) is genuinely
 * live, or whether the server has fallen back to its memory-disk backend
 * (no Firebase Admin credentials configured) — in which case an onSnapshot
 * listener would silently connect and receive nothing, forever, with no
 * error. Production must not depend on Firestore being configured for
 * messaging to work, so every conversation surface checks this once and
 * runs a REST-polling safety net when it's not live.
 */

export type MessagingTransport = 'firestore-realtime' | 'rest-polling';

let cached: Promise<MessagingTransport> | null = null;

async function fetchTransport(): Promise<MessagingTransport> {
  try {
    const res = await fetch('/api/v1/messaging/persistence-mode');
    const body = (await res.json().catch(() => ({}))) as {
      data?: { realtime?: boolean };
    };
    return body?.data?.realtime ? 'firestore-realtime' : 'rest-polling';
  } catch {
    // Fail-safe: if we can't confirm Firestore is live, assume it isn't —
    // polling is the one path that's never silently broken.
    return 'rest-polling';
  }
}

/** Cached for the page session — the backend doesn't change mode at runtime. */
export function getMessagingTransport(): Promise<MessagingTransport> {
  if (!cached) {
    cached = fetchTransport().then((transport) => {
      console.info(`[Messaging] transport: ${transport}`);
      return transport;
    });
  }
  return cached;
}
