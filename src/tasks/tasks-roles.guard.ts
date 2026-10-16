import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksRolesGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const routeId = request.params.id ?? request.params.projectId;
    const userId = request.user?.sub;

    if (typeof routeId !== 'string' || !isUUID(routeId)) {
      throw new BadRequestException('Project or task ID must be a UUID');
    }
    if (!userId) {
      throw new ForbiddenException('Workspace membership is required');
    }

    const projectId = request.params.projectId
      ? routeId
      : (
          await this.prisma.task.findFirst({
            where: { id: routeId, deletedAt: null },
            select: { projectId: true },
          })
        )?.projectId;

    if (!projectId) {
      throw new NotFoundException('Task not found');
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
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('Task not found');
    }

    return true;
  }
}
