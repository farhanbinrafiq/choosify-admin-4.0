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
    }

    interface Locals {
      requestId?: string;
      requestStartedAt?: number;
      requestDurationMs?: number;
    }
  }
}

export {};