import {
  CanActivate,
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';
import { WorkspaceRole } from './workspace-role.enum';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const workspaceId = request.params.id ?? request.params.workspaceId;
    const userId = request.user?.sub;

    if (!workspaceId && !requiredRoles?.length) {
      return true;
    }
    if (typeof workspaceId !== 'string' || !isUUID(workspaceId)) {
      throw new BadRequestException('Workspace ID must be a UUID');
    }
    if (!userId) {
      throw new ForbiddenException('Workspace membership is required');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
    const role = Object.values(WorkspaceRole).find(
      (value) => value === membership.role,
    );
    if (!role || (requiredRoles?.length && !requiredRoles.includes(role))) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }
}
