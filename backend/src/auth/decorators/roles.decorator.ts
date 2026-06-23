import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/** Restrict a route/controller to one or more UserRole values. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
