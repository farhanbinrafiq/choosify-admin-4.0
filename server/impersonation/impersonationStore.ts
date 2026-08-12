import { Logger } from '../lib/logger';

export type ImpersonationSession = {
  impersonationSessionId: string;
  adminUserId: string;
  adminRole?: string;
  adminChoosifyUserId?: string;
  targetUserId: string;
  targetRole?: string;
  targetChoosifyUserId?: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  reason?: string;
};

const state: Map<string, ImpersonationSession> = new Map();

export function getImpersonationSession(sessionId: string): ImpersonationSession | null {
  return state.get(sessionId) ?? null;
}

export function cleanupExpiredImpersonations(now = new Date()): void {
  for (const [id, sess] of state.entries()) {
    if (new Date(sess.expiresAt).getTime() > now.getTime()) continue;
    if (sess.endedAt) continue;
    sess.endedAt = now.toISOString();
    // We also keep the session record for audit/history.
    state.set(id, sess);
    Logger.audit('ImpersonationExpired', {
      impersonationSessionId: sess.impersonationSessionId,
      adminUserId: sess.adminUserId,
      targetUserId: sess.targetUserId,
      targetRole: sess.targetRole,
      reason: sess.reason,
      startedAt: sess.startedAt,
      expiresAt: sess.expiresAt,
      endedAt: sess.endedAt,
    });
  }
}

export function createImpersonationSession(input: {
  impersonationSessionId: string;
  adminUserId: string;
  adminRole?: string;
  adminChoosifyUserId?: string;
  targetUserId: string;
  targetRole?: string;
  targetChoosifyUserId?: string;
  startedAt: string;
  expiresAt: string;
  reason?: string;
}): ImpersonationSession {
  const sess: ImpersonationSession = {
    impersonationSessionId: input.impersonationSessionId,
    adminUserId: input.adminUserId,
    adminRole: input.adminRole,
    adminChoosifyUserId: input.adminChoosifyUserId,
    targetUserId: input.targetUserId,
    targetRole: input.targetRole,
    targetChoosifyUserId: input.targetChoosifyUserId,
    startedAt: input.startedAt,
    expiresAt: input.expiresAt,
    reason: input.reason,
  };
  state.set(sess.impersonationSessionId, sess);
  return sess;
}

/** Admin support: read a session (including ended) for audit verification. */
export function listImpersonationSessions(): ImpersonationSession[] {
  return Array.from(state.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function endImpersonationSession(sessionId: string): ImpersonationSession | null {
  const sess = state.get(sessionId);
  if (!sess) return null;
  if (sess.endedAt) return sess;
  const endedAt = new Date().toISOString();
  const next = { ...sess, endedAt };
  state.set(sessionId, next);
  return next;
}

