import { ROLES } from '../permissions/roles';
import { requireRole } from './authorization';

export const requireSeller = requireRole(ROLES.SELLER);
