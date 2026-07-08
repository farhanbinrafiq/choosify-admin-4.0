import { ROLES } from '../permissions/roles';
import { requireRole } from './authorization';

export const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);
