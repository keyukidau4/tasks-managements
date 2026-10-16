import {
  BadRequestException,
  CanActivate,
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
import { WORKSPACE_ROLES_KEY } from '../workspaces/workspace-roles.decorator';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';

@Injectable()
export class ProjectRolesGuard implements CanActivate {
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
    const projectId = request.params.id;
    const userId = request.user?.sub;

    if (typeof projectId !== 'string' || !isUUID(projectId)) {
      throw new BadRequestException('Project ID must be a UUID');
    }
    if (!userId) {
      throw new ForbiddenException('Workspace membership is required');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: project.workspaceId, userId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Project not found');
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
