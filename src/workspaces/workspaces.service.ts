import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRole } from './workspace-role.enum';

const workspaceSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Workspace name must not be empty');
    }

    return this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.create({
        data: {
          name,
          description: dto.description?.trim() || null,
          ownerId: userId,
        },
        select: workspaceSelect,
      });

      await transaction.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });

      return workspace;
    });
  }

  async findOne(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { workspaceId: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        ...workspaceSelect,
        members: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    const changes: Prisma.WorkspaceUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Workspace name must not be empty');
      }
      changes.name = name;
    }

    if (dto.description !== undefined) {
      changes.description = dto.description?.trim() || null;
    }

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'At least one workspace field must be provided',
      );
    }

    await this.requireManagerMembership(userId, workspaceId);

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: changes,
      select: workspaceSelect,
    });
  }

  async inviteMember(userId: string, workspaceId: string, email: string) {
    await this.requireManagerMembership(userId, workspaceId);

    const invitedUser = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    if (!invitedUser) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitedUser.id,
          role: WorkspaceRole.MEMBER,
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a workspace member');
      }
      throw error;
    }
  }

  async removeMember(
    userId: string,
    workspaceId: string,
    memberUserId: string,
  ): Promise<{ removed: true }> {
    await this.requireManagerMembership(userId, workspaceId);

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: memberUserId },
      },
      select: { id: true, role: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }
    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }

    await this.prisma.workspaceMember.delete({
      where: { id: membership.id },
    });
    return { removed: true };
  }

  private async requireManagerMembership(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only workspace owners and admins can manage members',
      );
    }
    return membership;
  }
}
