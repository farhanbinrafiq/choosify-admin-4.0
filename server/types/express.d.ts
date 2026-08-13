import type { AuthenticatedUser } from '../auth/authProfile';
import type { Permission } from '../permissions/permissions';
import type { UserRole } from '../permissions/roles';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      userId?: string;
      userRole?: UserRole;
      permissions?: readonly Permission[];
      // Impersonation (server-authoritative) metadata.
      // When present, `userId/userRole` represent the effective actor (target account).
      // `realActor*` represent the admin/super_admin that initiated impersonation.
      impersonationSessionId?: string;
      realActorUserId?: string;
      realActorRole?: string;
      /** Set by requireMarketplaceAccess — true when commercial APIs must stay locked. */
      partnerMarketplaceLocked?: boolean;
    }

    interface Locals {
      requestId?: string;
      requestStartedAt?: number;
      requestDurationMs?: number;
    }
  }
}

export {};