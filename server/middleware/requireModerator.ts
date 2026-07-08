import { ROLES } from '../permissions/roles';
import { requireRole } from './authorization';

export const requireModerator = requireRole(ROLES.MODERATOR);
