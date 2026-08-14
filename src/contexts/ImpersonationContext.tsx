import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { LoginAsConfirmModal } from '../components/account/LoginAsConfirmModal';
import {
  IMPERSONATION_DASHBOARD_PATH,
  canonicalImpersonationReturnPath,
  safeImpersonationReturnPath,
  type LoginAsConfirmTarget,
} from '../lib/impersonationRouting';

type ImpersonationState = {
  active: boolean;
  impersonationSessionId?: string;
  adminUserId?: string;
  adminRole?: string;
  targetUserId?: string;
  targetRole?: string;
  startedAt?: string;
  expiresAt?: string;
  reason?: string;
};

type ImpersonationContextType = {
  state: ImpersonationState;
  confirmTarget: LoginAsConfirmTarget | null;
  refresh: () => Promise<void>;
  openLoginAsConfirm: (target: LoginAsConfirmTarget) => void;
  closeLoginAsConfirm: () => void;
  startImpersonation: (args: { targetUserId: string; reason: string }) => Promise<void>;
  exitImpersonation: () => Promise<void>;
};

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'choosify_auth_token';
const ORIGINAL_TOKEN_KEY = 'choosify_impersonation_original_token';
const RETURN_PATH_KEY = 'choosify_impersonation_return_path';
const DEFAULT_REASON = 'Customer support / diagnostics';

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function snapshotCurrentReturnPath(): string {
  return canonicalImpersonationReturnPath(window.location.pathname, window.location.search);
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [state, setState] = useState<ImpersonationState>({ active: false });
  const [confirmTarget, setConfirmTarget] = useState<LoginAsConfirmTarget | null>(null);
  const [loginAsReason, setLoginAsReason] = useState(DEFAULT_REASON);
  const [loginAsError, setLoginAsError] = useState<string | null>(null);
  const [loginAsBusy, setLoginAsBusy] = useState(false);
  const returnPathSnapshotRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const token = safeLocalStorageGet(AUTH_TOKEN_KEY);
    if (!token) {
      setState({ active: false });
      return;
    }
    try {
      const res = await fetch(`/api/v1/auth/impersonate/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || body?.success === false) {
        setState({ active: false });
        return;
      }
      if (!body.active) {
        setState({ active: false });
        return;
      }
      setState({
        active: true,
        impersonationSessionId: body.impersonationSessionId,
        adminUserId: body.adminUserId,
        adminRole: body.adminRole,
        targetUserId: body.targetUserId,
        targetRole: body.targetRole,
        startedAt: body.startedAt,
        expiresAt: body.expiresAt,
        reason: body.reason,
      });
    } catch {
      setState({ active: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  const closeLoginAsConfirm = useCallback(() => {
    if (loginAsBusy) return;
    setConfirmTarget(null);
    setLoginAsError(null);
    setLoginAsBusy(false);
    setLoginAsReason(DEFAULT_REASON);
    returnPathSnapshotRef.current = null;
  }, [loginAsBusy]);

  const openLoginAsConfirm = useCallback(
    (target: LoginAsConfirmTarget) => {
      const targetUserId = String(target.targetUserId || '').trim();
      if (!targetUserId) return;
      if (state.active) return;
      if (profile?.id && targetUserId === profile.id) return;
      returnPathSnapshotRef.current = snapshotCurrentReturnPath();
      setLoginAsError(null);
      setLoginAsBusy(false);
      setLoginAsReason(DEFAULT_REASON);
      setConfirmTarget({
        ...target,
        targetUserId,
        displayName: target.displayName || 'User',
        roleLabel: target.roleLabel || 'User',
      });
    },
    [profile?.id, state.active],
  );

  const startImpersonation = useCallback(
    async (args: { targetUserId: string; reason: string }) => {
      const token = safeLocalStorageGet(AUTH_TOKEN_KEY);
      if (!token) throw new Error('Sign in required');

      // Do not allow nested impersonation: if server-side already treats this token
      // as impersonation, the auth endpoint should deny.
      const res = await fetch(`/api/v1/auth/impersonate/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: args.targetUserId, reason: args.reason }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || body?.success === false || !body?.accessToken) {
        throw new Error(body?.error || body?.message || `Impersonation failed (${res.status})`);
      }

      const currentToken = safeLocalStorageGet(AUTH_TOKEN_KEY);
      if (currentToken && !safeLocalStorageGet(ORIGINAL_TOKEN_KEY)) {
        safeLocalStorageSet(ORIGINAL_TOKEN_KEY, currentToken);
      }
      const returnPath = safeImpersonationReturnPath(
        returnPathSnapshotRef.current || snapshotCurrentReturnPath(),
      );
      safeLocalStorageSet(RETURN_PATH_KEY, returnPath);
      returnPathSnapshotRef.current = returnPath;

      safeLocalStorageSet(AUTH_TOKEN_KEY, body.accessToken);
      window.location.assign(IMPERSONATION_DASHBOARD_PATH);
    },
    [refresh],
  );

  const confirmLoginAs = useCallback(async () => {
    if (!confirmTarget) return;
    setLoginAsBusy(true);
    setLoginAsError(null);
    try {
      await startImpersonation({
        targetUserId: confirmTarget.targetUserId,
        reason: loginAsReason.trim() || DEFAULT_REASON,
      });
    } catch (e) {
      setLoginAsError(e instanceof Error ? e.message : String(e));
      setLoginAsBusy(false);
    }
  }, [confirmTarget, loginAsReason, startImpersonation]);

  const exitImpersonation = useCallback(async () => {
    const token = safeLocalStorageGet(AUTH_TOKEN_KEY);
    if (!token) return;

    try {
      await fetch(`/api/v1/auth/impersonate/exit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      const original = safeLocalStorageGet(ORIGINAL_TOKEN_KEY);
      if (original) {
        safeLocalStorageSet(AUTH_TOKEN_KEY, original);
      }
      safeLocalStorageRemove(ORIGINAL_TOKEN_KEY);
      const returnPath = safeImpersonationReturnPath(safeLocalStorageGet(RETURN_PATH_KEY));
      safeLocalStorageRemove(RETURN_PATH_KEY);
      // Single navigation restores Admin session (do not reload then mutate pathname).
      window.location.assign(returnPath);
    }
  }, []);

  const value = useMemo<ImpersonationContextType>(
    () => ({
      state,
      confirmTarget,
      refresh,
      openLoginAsConfirm,
      closeLoginAsConfirm,
      startImpersonation,
      exitImpersonation,
    }),
    [
      closeLoginAsConfirm,
      confirmTarget,
      exitImpersonation,
      openLoginAsConfirm,
      refresh,
      startImpersonation,
      state,
    ],
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
      {confirmTarget ? (
        <LoginAsConfirmModal
          target={confirmTarget}
          reason={loginAsReason}
          error={loginAsError}
          busy={loginAsBusy}
          onReasonChange={setLoginAsReason}
          onCancel={closeLoginAsConfirm}
          onContinue={() => void confirmLoginAs()}
        />
      ) : null}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

export type { LoginAsConfirmTarget };
