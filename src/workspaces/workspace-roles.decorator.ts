import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from './workspace-role.enum';

export const WORKSPACE_ROLES_KEY = 'workspace-roles';

export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
