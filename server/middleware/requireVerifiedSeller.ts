import { ROLES } from '../permissions/roles';
import { requireRole } from './authorization';

export const requireVerifiedSeller = requireRole(ROLES.VERIFIED_SELLER);
