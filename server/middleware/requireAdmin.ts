import { ROLES } from '../permissions/roles';
import { requireRole } from './authorization';

export const requireAdmin = requireRole(ROLES.ADMIN);
